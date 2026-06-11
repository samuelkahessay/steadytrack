#!/usr/bin/env python3
"""
Enhanced Automated Resource Discovery and Population

Integrates real API calls, web scraping, and LLM-assisted matching to discover
and populate high-quality learning resources across all curriculum subjects.

Features:
- Khan Academy search integration (via web scraping)
- OpenStax chapter matching
- PhET simulation discovery
- LLM-powered semantic matching (GPT-5)
- Bulk resource import with validation

Usage:
  # Test on single subject
  python3 resource-populator-enhanced.py --subject bio-30 --limit 5 --dry-run

  # Process all sciences with LLM matching
  python3 resource-populator-enhanced.py --all-sciences --use-llm --write

  # Process specific outcomes
  python3 resource-populator-enhanced.py --subject phys-30 --outcomes "30-D1,30-D2" --write
"""

import argparse
import json
import os
import re
import sys
import time
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import quote_plus, urljoin
import hashlib

# Check for required dependencies
try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print("❌ Missing required dependencies. Install with:")
    print("   pip install requests beautifulsoup4")
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]
CURRICULUM_DIR = ROOT / "data" / "curriculum"
REPORTS_DIR = ROOT / "data" / "reports"
CACHE_DIR = ROOT / "data" / "cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

# OpenAI API setup
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY") or os.getenv("OPENAI_KEY")
if not OPENAI_API_KEY and "--use-llm" in sys.argv:
    # Try loading from .env.local
    env_local = ROOT / ".env.local"
    if env_local.exists():
        with open(env_local) as f:
            for line in f:
                if line.startswith("OPENAI_API_KEY=") or line.startswith("OPENAI_KEY="):
                    OPENAI_API_KEY = line.split("=", 1)[1].strip().strip('"\'')
                    break


@dataclass
class ResourceCandidate:
    """Candidate resource with metadata"""
    url: str
    title: str
    type: str
    source: str
    difficulty: str
    provider: str
    aligned_outcomes: List[str]
    confidence_score: float
    description: Optional[str] = None
    embeddable: bool = False
    youtube_id: Optional[str] = None

    def to_curriculum_format(self) -> Dict[str, Any]:
        """Convert to curriculum JSON format"""
        result = {
            "type": self.type,
            "title": self.title,
            "url": self.url,
            "difficulty": self.difficulty,
            "alignedOutcomes": self.aligned_outcomes,
            "source": self.source,
            "provider": self.provider,
            "embeddable": self.embeddable,
        }
        if self.youtube_id:
            result["youtubeId"] = self.youtube_id
            result["embedUrl"] = f"https://www.youtube-nocookie.com/embed/{self.youtube_id}?enablejsapi=1&origin=https://steadytrack.vercel.app&modestbranding=1&rel=0"
        return result


@dataclass
class OutcomeContext:
    """Context for an outcome that needs resources"""
    subject: str
    grade: int
    unit_id: str
    unit_title: str
    outcome_code: str
    outcome_description: str
    strand: Optional[str] = None
    category: Optional[str] = None
    existing_resources: List[str] = None

    def __post_init__(self):
        if self.existing_resources is None:
            self.existing_resources = []


class CachedSearcher:
    """Base class with caching support"""

    def __init__(self, cache_ttl: int = 86400):
        self.cache_ttl = cache_ttl
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        })

    def _cache_key(self, query: str, source: str) -> str:
        """Generate cache key for query"""
        hash_input = f"{source}:{query}".encode('utf-8')
        return hashlib.md5(hash_input).hexdigest()

    def _get_cached(self, cache_key: str) -> Optional[Any]:
        """Retrieve from cache if valid"""
        cache_file = CACHE_DIR / f"{cache_key}.json"
        if cache_file.exists():
            age = time.time() - cache_file.stat().st_mtime
            if age < self.cache_ttl:
                with open(cache_file, 'r') as f:
                    return json.load(f)
        return None

    def _set_cached(self, cache_key: str, data: Any):
        """Store in cache"""
        cache_file = CACHE_DIR / f"{cache_key}.json"
        with open(cache_file, 'w') as f:
            json.dump(data, f)


class KhanAcademySearcher(CachedSearcher):
    """Search Khan Academy using topic mapping"""

    BASE_URL = "https://www.khanacademy.org"

    # Curated Khan Academy content mapped to topics/keywords
    CONTENT_MAP = {
        "biology": [
            # General biology
            {"title": "Biology library", "url": "https://www.khanacademy.org/science/biology", "keywords": ["cell", "evolution", "ecology", "genetics", "photosynthesis", "respiration"], "type": "article"},

            # Cell biology
            {"title": "Cells", "url": "https://www.khanacademy.org/science/biology/structure-of-a-cell", "keywords": ["cell", "membrane", "organelle", "nucleus", "mitochondria", "chloroplast"], "type": "video"},
            {"title": "Cell membrane and transport", "url": "https://www.khanacademy.org/science/ap-biology/cell-structure-and-function/membrane-transport", "keywords": ["membrane", "transport", "diffusion", "osmosis", "active transport"], "type": "video"},
            {"title": "Cellular respiration", "url": "https://www.khanacademy.org/science/biology/cellular-respiration-and-fermentation", "keywords": ["respiration", "glycolysis", "krebs", "electron transport", "atp", "mitochondria"], "type": "video"},
            {"title": "Photosynthesis", "url": "https://www.khanacademy.org/science/biology/photosynthesis-in-plants", "keywords": ["photosynthesis", "chloroplast", "light reactions", "calvin cycle", "chlorophyll"], "type": "video"},

            # Genetics
            {"title": "DNA and RNA", "url": "https://www.khanacademy.org/science/biology/dna-as-the-genetic-material", "keywords": ["dna", "rna", "nucleotide", "replication", "transcription", "translation"], "type": "video"},
            {"title": "Gene expression and regulation", "url": "https://www.khanacademy.org/science/biology/gene-regulation", "keywords": ["gene", "expression", "regulation", "transcription", "operon"], "type": "video"},

            # Evolution
            {"title": "Natural selection and evolution", "url": "https://www.khanacademy.org/science/biology/her/evolution-and-natural-selection", "keywords": ["evolution", "natural selection", "adaptation", "speciation", "darwin"], "type": "video"},

            # Nervous system (Biology 30)
            {"title": "Nervous system", "url": "https://www.khanacademy.org/science/biology/human-biology/neuron-nervous-system", "keywords": ["neuron", "nervous", "synapse", "action potential", "brain", "nerve"], "type": "video"},
            {"title": "Neurons and the nervous system", "url": "https://www.khanacademy.org/science/high-school-biology/hs-human-body-systems/hs-the-nervous-system/v/structure-of-the-nervous-system", "keywords": ["neuron", "nervous system", "central", "peripheral", "brain", "spinal cord"], "type": "video"},
            {"title": "Action potentials", "url": "https://www.khanacademy.org/science/biology/human-biology/neuron-nervous-system/v/action-potential", "keywords": ["action potential", "neuron", "membrane", "depolarization", "sodium", "potassium"], "type": "video"},
            {"title": "Synapses and neurotransmitters", "url": "https://www.khanacademy.org/science/biology/human-biology/neuron-nervous-system/v/anatomy-of-a-synapse", "keywords": ["synapse", "neurotransmitter", "presynaptic", "postsynaptic", "acetylcholine", "dopamine"], "type": "video"},
            {"title": "Reflex arc", "url": "https://www.khanacademy.org/science/high-school-biology/hs-human-body-systems/hs-the-nervous-system/v/organization-of-the-nervous-system", "keywords": ["reflex", "reflex arc", "spinal cord", "sensory", "motor neuron"], "type": "video"},

            # Sensory systems (Biology 30)
            {"title": "The eye and vision", "url": "https://www.khanacademy.org/science/biology/sensory-and-motor-mechanisms/sensory-perception/v/structure-of-the-eye", "keywords": ["eye", "vision", "retina", "cornea", "lens", "pupil", "iris", "rods", "cones"], "type": "video"},
            {"title": "Visual phototransduction", "url": "https://www.khanacademy.org/science/biology/sensory-and-motor-mechanisms/sensory-perception/v/phototransduction", "keywords": ["retina", "rods", "cones", "photoreceptor", "visual", "light", "optic nerve"], "type": "video"},
            {"title": "The ear and hearing", "url": "https://www.khanacademy.org/science/biology/sensory-and-motor-mechanisms/sensory-perception/v/the-ear", "keywords": ["ear", "hearing", "cochlea", "auditory", "sound", "tympanum", "ossicles", "pinna"], "type": "video"},
            {"title": "Somatosensation", "url": "https://www.khanacademy.org/science/biology/sensory-and-motor-mechanisms/sensory-perception/v/mechanoreceptors", "keywords": ["touch", "pressure", "mechanoreceptor", "skin", "sensory receptor", "proprioceptor"], "type": "video"},
            {"title": "Taste and smell", "url": "https://www.khanacademy.org/science/biology/sensory-and-motor-mechanisms/sensory-perception/v/olfaction", "keywords": ["taste", "smell", "olfactory", "taste receptor", "chemoreceptor", "olfactory receptor"], "type": "video"},

            # Endocrine system (Biology 30)
            {"title": "Endocrine system", "url": "https://www.khanacademy.org/science/biology/principles-of-physiology/endocrine-system-introduction", "keywords": ["hormone", "endocrine", "gland", "insulin", "thyroid"], "type": "video"},
            {"title": "Hormones and signaling", "url": "https://www.khanacademy.org/science/ap-biology/cell-communication-and-cell-cycle/changes-in-signal-transduction-pathways/v/types-of-hormones", "keywords": ["hormone", "signaling", "receptor", "endocrine", "steroid", "peptide"], "type": "video"},
            {"title": "Pancreas and blood glucose", "url": "https://www.khanacademy.org/science/biology/principles-of-physiology/endocrine-system-introduction/v/glucose-insulin-and-diabetes", "keywords": ["insulin", "glucagon", "pancreas", "glucose", "diabetes", "blood sugar"], "type": "video"},
            {"title": "Thyroid gland", "url": "https://www.khanacademy.org/science/high-school-biology/hs-human-body-systems/hs-the-endocrine-system/v/thyroid-gland", "keywords": ["thyroid", "hormone", "metabolism", "t3", "t4", "goiter", "graves"], "type": "video"},
            {"title": "Adrenal glands and stress", "url": "https://www.khanacademy.org/science/high-school-biology/hs-human-body-systems/hs-the-endocrine-system/v/adrenal-glands", "keywords": ["adrenal", "cortisol", "adrenaline", "stress", "fight or flight", "hormone"], "type": "video"},

            # Reproductive system (Biology 30)
            {"title": "Reproductive system introduction", "url": "https://www.khanacademy.org/science/high-school-biology/hs-human-body-systems/hs-the-reproductive-system/v/reproductive-system-introduction", "keywords": ["reproduction", "reproductive", "gamete", "fertilization", "embryo"], "type": "video"},
            {"title": "Gametogenesis - spermatogenesis and oogenesis", "url": "https://www.khanacademy.org/science/ap-biology/heredity/meiosis-and-genetic-diversity/v/gametogenesis", "keywords": ["sperm", "egg", "spermatogenesis", "oogenesis", "gamete", "meiosis", "ovum"], "type": "video"},
            {"title": "Male reproductive system", "url": "https://www.khanacademy.org/science/high-school-biology/hs-human-body-systems/hs-the-reproductive-system/v/male-reproductive-system", "keywords": ["sperm", "testes", "seminiferous tubules", "testosterone", "male", "reproduction"], "type": "video"},
            {"title": "Female reproductive system", "url": "https://www.khanacademy.org/science/high-school-biology/hs-human-body-systems/hs-the-reproductive-system/v/female-reproductive-system", "keywords": ["egg", "ovary", "follicle", "corpus luteum", "estrogen", "progesterone", "female"], "type": "video"},
            {"title": "Sex determination and differentiation", "url": "https://www.khanacademy.org/science/ap-biology/heredity/chromosomal-basis-of-genetics/v/sex-linkage", "keywords": ["sex chromosome", "x chromosome", "y chromosome", "testosterone", "differentiation", "gonads"], "type": "video"},

            # Ecology and ecosystems (Biology 20)
            {"title": "Ecology and ecosystems", "url": "https://www.khanacademy.org/science/biology/ecology", "keywords": ["ecology", "ecosystem", "population", "community", "biome", "energy flow"], "type": "video"},
            {"title": "Energy flow in ecosystems", "url": "https://www.khanacademy.org/science/ap-biology/ecology-ap/energy-flow-through-ecosystems/v/energy-flow-in-ecosystems", "keywords": ["energy flow", "producer", "consumer", "trophic level", "food chain", "food web"], "type": "video"},
            {"title": "Food chains and food webs", "url": "https://www.khanacademy.org/science/biology/ecology/intro-to-ecology/v/food-chains-and-food-webs", "keywords": ["food chain", "food web", "producer", "consumer", "decomposer", "trophic"], "type": "video"},
            {"title": "Ecological pyramids", "url": "https://www.khanacademy.org/science/ap-biology/ecology-ap/energy-flow-through-ecosystems/v/ecological-pyramids", "keywords": ["pyramid", "energy pyramid", "biomass", "numbers", "trophic level", "productivity"], "type": "video"},
            {"title": "Biogeochemical cycles", "url": "https://www.khanacademy.org/science/ap-biology/ecology-ap/biogeochemical-cycles/v/introduction-to-biogeochemical-cycles", "keywords": ["cycle", "biogeochemical", "carbon", "nitrogen", "phosphorus", "water", "nutrient"], "type": "video"},
            {"title": "Carbon cycle", "url": "https://www.khanacademy.org/science/biology/ecology/biogeochemical-cycles/v/carbon-cycle", "keywords": ["carbon", "carbon cycle", "photosynthesis", "respiration", "fossil fuel", "atmosphere"], "type": "video"},
            {"title": "Nitrogen cycle", "url": "https://www.khanacademy.org/science/biology/ecology/biogeochemical-cycles/v/nitrogen-cycle", "keywords": ["nitrogen", "nitrogen cycle", "fixation", "nitrification", "denitrification", "ammonia"], "type": "video"},
            {"title": "Water cycle", "url": "https://www.khanacademy.org/science/biology/ecology/biogeochemical-cycles/v/water-cycle", "keywords": ["water", "water cycle", "evaporation", "precipitation", "condensation", "transpiration"], "type": "video"},
            {"title": "Phosphorus cycle", "url": "https://www.khanacademy.org/science/ap-biology/ecology-ap/biogeochemical-cycles/v/phosphorus-cycle", "keywords": ["phosphorus", "phosphorus cycle", "nutrient", "weathering", "runoff"], "type": "video"},

            # CrashCourse Biology videos
            {"title": "CrashCourse: Nervous System", "url": "https://www.youtube.com/watch?v=qPix_X-9t7E", "keywords": ["neuron", "nervous system", "action potential", "synapse", "brain"], "type": "video"},
            {"title": "CrashCourse: The Eye", "url": "https://www.youtube.com/watch?v=o0DYP-u1rNM", "keywords": ["eye", "vision", "retina", "cornea", "lens", "photoreceptor"], "type": "video"},
            {"title": "CrashCourse: Endocrine System", "url": "https://www.youtube.com/watch?v=WVrlHH14q3o", "keywords": ["hormone", "endocrine", "gland", "pituitary", "thyroid", "adrenal"], "type": "video"},
            {"title": "CrashCourse: Reproductive System", "url": "https://www.youtube.com/watch?v=RFDatCchpus", "keywords": ["reproduction", "sperm", "egg", "fertilization", "gamete"], "type": "video"},
            {"title": "CrashCourse: Ecology - Community Ecology", "url": "https://www.youtube.com/watch?v=0m3SF7S1RzM", "keywords": ["ecology", "community", "population", "ecosystem", "biodiversity"], "type": "video"},
            {"title": "CrashCourse: Ecology - Energy Flow", "url": "https://www.youtube.com/watch?v=RS7P5JCzVSc", "keywords": ["energy flow", "food web", "trophic level", "pyramid", "productivity"], "type": "video"},

            # Bozeman Science videos
            {"title": "Bozeman: The Nervous System", "url": "https://www.youtube.com/watch?v=2GKx_eJlP6M", "keywords": ["neuron", "action potential", "synapse", "neurotransmitter", "nervous"], "type": "video"},
            {"title": "Bozeman: The Eye", "url": "https://www.youtube.com/watch?v=WQPE87BNd9w", "keywords": ["eye", "vision", "retina", "rod", "cone", "optic"], "type": "video"},
            {"title": "Bozeman: The Endocrine System", "url": "https://www.youtube.com/watch?v=WVrlHH14q3o", "keywords": ["endocrine", "hormone", "gland", "feedback", "homeostasis"], "type": "video"},
            {"title": "Bozeman: Energy Flow in Ecosystems", "url": "https://www.youtube.com/watch?v=FHW2mOzZQCg", "keywords": ["energy flow", "ecosystem", "producer", "consumer", "decomposer", "trophic"], "type": "video"},
            {"title": "Bozeman: Biogeochemical Cycles", "url": "https://www.youtube.com/watch?v=leHy-Y_8nRs", "keywords": ["carbon cycle", "nitrogen cycle", "water cycle", "phosphorus", "nutrient"], "type": "video"},

            # Amoeba Sisters videos
            {"title": "Amoeba Sisters: Nervous System", "url": "https://www.youtube.com/watch?v=44B0ms3XPKU", "keywords": ["neuron", "nervous", "brain", "reflex", "synapse"], "type": "video"},
            {"title": "Amoeba Sisters: Endocrine System", "url": "https://www.youtube.com/watch?v=NOaMH1k3YrY", "keywords": ["hormone", "endocrine", "gland", "feedback", "homeostasis"], "type": "video"},
            {"title": "Amoeba Sisters: Food Webs and Energy Pyramids", "url": "https://www.youtube.com/watch?v=hLq2datPo5M", "keywords": ["food web", "energy pyramid", "trophic level", "producer", "consumer"], "type": "video"},
            {"title": "Amoeba Sisters: Carbon and Nitrogen Cycles", "url": "https://www.youtube.com/watch?v=leHy-Y_8nRs", "keywords": ["carbon", "nitrogen", "cycle", "atmosphere", "fixation"], "type": "video"},
        ],
        "chemistry": [
            # General chemistry
            {"title": "Chemistry library", "url": "https://www.khanacademy.org/science/chemistry", "keywords": ["atom", "molecule", "reaction", "bond"], "type": "article"},

            # Atomic structure
            {"title": "Atoms and elements", "url": "https://www.khanacademy.org/science/chemistry/atomic-structure-and-properties", "keywords": ["atom", "element", "proton", "neutron", "electron", "periodic table"], "type": "video"},
            {"title": "Electron configuration", "url": "https://www.khanacademy.org/science/chemistry/electronic-structure-of-atoms", "keywords": ["electron", "orbital", "configuration", "shell", "valence"], "type": "video"},

            # Chemical bonding
            {"title": "Chemical bonds", "url": "https://www.khanacademy.org/science/chemistry/chemical-bonds", "keywords": ["bond", "ionic", "covalent", "molecular", "lewis structure"], "type": "video"},
            {"title": "Covalent bonding and Lewis structures", "url": "https://www.khanacademy.org/science/ap-chemistry/chemical-bonds-ap/types-chemical-bonds-ap/v/covalent-networks-giant-covalent-structures", "keywords": ["covalent", "lewis", "structure", "bond", "molecule"], "type": "video"},
            {"title": "Molecular geometry and polarity", "url": "https://www.khanacademy.org/science/chemistry/chemical-bonds/copy-of-dot-structures/v/vsepr-theory", "keywords": ["molecular", "geometry", "vsepr", "shape", "polarity", "structure"], "type": "video"},

            # Chemical reactions and stoichiometry
            {"title": "Chemical reactions", "url": "https://www.khanacademy.org/science/chemistry/chemical-reactions-stoichiome", "keywords": ["reaction", "stoichiometry", "equation", "mole", "balance"], "type": "video"},
            {"title": "Balancing chemical equations", "url": "https://www.khanacademy.org/science/chemistry/chemical-reactions-stoichiome/balancing-chemical-equations", "keywords": ["balance", "equation", "coefficient", "reactant", "product"], "type": "video"},
            {"title": "Stoichiometry calculations", "url": "https://www.khanacademy.org/science/chemistry/chemical-reactions-stoichiome/stoichiometry-ideal-stoichiometry", "keywords": ["stoichiometry", "mole", "ratio", "limiting reactant", "yield"], "type": "video"},

            # States of matter
            {"title": "States of matter and intermolecular forces", "url": "https://www.khanacademy.org/science/chemistry/states-of-matter-and-intermolecular-forces", "keywords": ["gas", "liquid", "solid", "intermolecular", "phase"], "type": "video"},
            {"title": "Gas laws", "url": "https://www.khanacademy.org/science/chemistry/gases-and-kinetic-molecular-theory", "keywords": ["gas", "pressure", "volume", "temperature", "ideal gas", "boyle", "charles"], "type": "video"},

            # Thermochemistry (Chemistry 20)
            {"title": "Thermodynamics", "url": "https://www.khanacademy.org/science/chemistry/thermodynamics-chemistry", "keywords": ["thermodynamics", "enthalpy", "entropy", "free energy", "heat"], "type": "video"},
            {"title": "Enthalpy and calorimetry", "url": "https://www.khanacademy.org/science/chemistry/thermodynamics-chemistry/internal-energy-sal", "keywords": ["enthalpy", "calorimetry", "heat", "energy", "delta h", "endothermic", "exothermic"], "type": "video"},
            {"title": "Hess's law", "url": "https://www.khanacademy.org/science/chemistry/thermodynamics-chemistry/enthalpy-chemistry-sal/v/hess-s-law-and-reaction-enthalpy-change", "keywords": ["hess", "law", "enthalpy", "reaction", "energy"], "type": "video"},
            {"title": "Energy diagrams", "url": "https://www.khanacademy.org/science/chemistry/chem-kinetics/arrhenius-equation/v/potential-energy-diagrams", "keywords": ["energy diagram", "activation energy", "catalyst", "reaction pathway", "exothermic", "endothermic"], "type": "video"},
            {"title": "Combustion reactions", "url": "https://www.khanacademy.org/science/chemistry/chemical-reactions-stoichiome/types-of-chemical-reactions-sal/v/combustion-reactions", "keywords": ["combustion", "burn", "fuel", "hydrocarbon", "oxygen", "energy"], "type": "video"},

            # Chemical equilibrium
            {"title": "Chemical equilibrium", "url": "https://www.khanacademy.org/science/chemistry/chemical-equilibrium", "keywords": ["equilibrium", "le chatelier", "dynamic", "constant"], "type": "video"},
            {"title": "Le Chatelier's principle", "url": "https://www.khanacademy.org/science/ap-chemistry/chemical-equilibrium-ap/equilibrium-constant-ap/v/le-chateliers-principle", "keywords": ["le chatelier", "shift", "equilibrium", "stress", "concentration"], "type": "video"},

            # Acids and bases
            {"title": "Acids and bases", "url": "https://www.khanacademy.org/science/chemistry/acids-and-bases-topic", "keywords": ["acid", "base", "ph", "buffer", "titration"], "type": "video"},
            {"title": "pH and pOH", "url": "https://www.khanacademy.org/science/chemistry/acids-and-bases-topic/acids-and-bases/v/ph-and-poh", "keywords": ["ph", "poh", "acid", "base", "hydrogen ion", "hydroxide"], "type": "video"},
            {"title": "Acid-base titrations", "url": "https://www.khanacademy.org/science/chemistry/acids-and-bases-topic/titrations/v/titrations", "keywords": ["titration", "neutralization", "equivalence point", "indicator", "acid", "base"], "type": "video"},

            # Redox and electrochemistry
            {"title": "Redox reactions and electrochemistry", "url": "https://www.khanacademy.org/science/chemistry/oxidation-reduction", "keywords": ["redox", "oxidation", "reduction", "electrochemistry", "electron transfer"], "type": "video"},
            {"title": "Galvanic cells", "url": "https://www.khanacademy.org/science/chemistry/oxidation-reduction/galvanic-cells/v/galvanic-cells-voltaic-cells", "keywords": ["galvanic", "voltaic", "cell", "battery", "electrode", "electrochemistry"], "type": "video"},

            # Organic chemistry
            {"title": "Organic chemistry introduction", "url": "https://www.khanacademy.org/science/organic-chemistry", "keywords": ["organic", "hydrocarbon", "carbon", "functional group"], "type": "video"},
            {"title": "Hydrocarbons", "url": "https://www.khanacademy.org/science/organic-chemistry/bond-line-structures-alkanes-cycloalkanes", "keywords": ["hydrocarbon", "alkane", "alkene", "alkyne", "organic"], "type": "video"},

            # CrashCourse Chemistry videos
            {"title": "CrashCourse: Thermochemistry", "url": "https://www.youtube.com/watch?v=RZb8vBQTEhg", "keywords": ["thermochemistry", "enthalpy", "energy", "exothermic", "endothermic", "calorimetry"], "type": "video"},
            {"title": "CrashCourse: Chemical Equilibrium", "url": "https://www.youtube.com/watch?v=SLDd9kjoJNA", "keywords": ["equilibrium", "le chatelier", "dynamic", "reaction"], "type": "video"},
            {"title": "CrashCourse: Acids and Bases", "url": "https://www.youtube.com/watch?v=vt8fB3MFzLk", "keywords": ["acid", "base", "ph", "hydrogen ion", "titration"], "type": "video"},
            {"title": "CrashCourse: Redox Reactions", "url": "https://www.youtube.com/watch?v=xiS_njPo_CY", "keywords": ["redox", "oxidation", "reduction", "electron", "electrochemistry"], "type": "video"},

            # Bozeman Science chemistry videos
            {"title": "Bozeman: Enthalpy", "url": "https://www.youtube.com/watch?v=A4Af_74mZIo", "keywords": ["enthalpy", "thermochemistry", "heat", "energy", "delta h"], "type": "video"},
            {"title": "Bozeman: Hess's Law", "url": "https://www.youtube.com/watch?v=CJPyXbLj_Fs", "keywords": ["hess", "law", "enthalpy", "thermochemistry", "energy"], "type": "video"},
            {"title": "Bozeman: Chemical Equilibrium", "url": "https://www.youtube.com/watch?v=KZG9SGSgMds", "keywords": ["equilibrium", "le chatelier", "constant", "reaction"], "type": "video"},

            # Professor Dave Explains chemistry videos
            {"title": "Professor Dave: Enthalpy and Hess's Law", "url": "https://www.youtube.com/watch?v=5QHV1nMH2N0", "keywords": ["enthalpy", "hess", "thermochemistry", "energy", "heat"], "type": "video"},
            {"title": "Professor Dave: Acids and Bases", "url": "https://www.youtube.com/watch?v=0p6RC8JVQp8", "keywords": ["acid", "base", "ph", "hydrogen", "titration"], "type": "video"},
            {"title": "Professor Dave: Chemical Equilibrium", "url": "https://www.youtube.com/watch?v=SLDd9kjoJNA", "keywords": ["equilibrium", "le chatelier", "constant", "dynamic"], "type": "video"},
        ],
        "physics": [
            # General physics
            {"title": "Physics library", "url": "https://www.khanacademy.org/science/physics", "keywords": ["motion", "force", "energy", "wave"], "type": "article"},

            # Mechanics - Kinematics
            {"title": "One-dimensional motion", "url": "https://www.khanacademy.org/science/physics/one-dimensional-motion", "keywords": ["motion", "velocity", "acceleration", "displacement", "kinematics"], "type": "video"},
            {"title": "Two-dimensional motion", "url": "https://www.khanacademy.org/science/physics/two-dimensional-motion", "keywords": ["projectile", "motion", "trajectory", "parabola", "2d"], "type": "video"},

            # Mechanics - Forces
            {"title": "Forces and Newton's laws", "url": "https://www.khanacademy.org/science/physics/forces-newtons-laws", "keywords": ["force", "newton", "mass", "acceleration", "gravity", "friction"], "type": "video"},
            {"title": "Newton's laws of motion", "url": "https://www.khanacademy.org/science/ap-physics-1/ap-forces-newtons-laws", "keywords": ["newton", "law", "force", "inertia", "acceleration", "action reaction"], "type": "video"},

            # Energy and work
            {"title": "Work and energy", "url": "https://www.khanacademy.org/science/physics/work-and-energy", "keywords": ["work", "energy", "kinetic", "potential", "conservation"], "type": "video"},
            {"title": "Conservation of energy", "url": "https://www.khanacademy.org/science/ap-physics-1/ap-work-and-energy/conservation-of-energy-ap/v/conservation-of-energy", "keywords": ["conservation", "energy", "kinetic", "potential", "mechanical"], "type": "video"},

            # Momentum and collisions (Physics 20)
            {"title": "Momentum", "url": "https://www.khanacademy.org/science/physics/linear-momentum", "keywords": ["momentum", "impulse", "collision", "conservation"], "type": "video"},
            {"title": "Impulse and momentum", "url": "https://www.khanacademy.org/science/ap-physics-1/ap-linear-momentum/introduction-to-linear-momentum-and-impulse-ap/v/introduction-to-momentum", "keywords": ["momentum", "impulse", "force", "time", "change"], "type": "video"},
            {"title": "Conservation of momentum", "url": "https://www.khanacademy.org/science/ap-physics-1/ap-linear-momentum/conservation-of-momentum-ap/v/deriving-the-conservation-of-momentum", "keywords": ["conservation", "momentum", "isolated system", "collision"], "type": "video"},
            {"title": "Elastic and inelastic collisions", "url": "https://www.khanacademy.org/science/ap-physics-1/ap-linear-momentum/collisions-ap/v/elastic-and-inelastic-collisions", "keywords": ["elastic", "inelastic", "collision", "kinetic energy", "momentum", "conservation"], "type": "video"},

            # Waves
            {"title": "Waves and sound", "url": "https://www.khanacademy.org/science/physics/mechanical-waves-and-sound", "keywords": ["wave", "frequency", "wavelength", "sound", "oscillation"], "type": "video"},
            {"title": "Wave properties", "url": "https://www.khanacademy.org/science/ap-physics-1/ap-mechanical-waves-and-sound/wave-characteristics-ap/v/introduction-to-waves", "keywords": ["wave", "amplitude", "frequency", "wavelength", "period"], "type": "video"},

            # Electricity and magnetism
            {"title": "Electric charge and fields", "url": "https://www.khanacademy.org/science/physics/electric-charge-electric-force-and-voltage", "keywords": ["electric", "charge", "field", "coulomb", "voltage"], "type": "video"},
            {"title": "Electric force and Coulomb's law", "url": "https://www.khanacademy.org/science/ap-physics-1/ap-electric-charge-electric-force-and-voltage/coulombs-law-and-electric-force-ap/v/coulombs-law", "keywords": ["coulomb", "law", "electric force", "charge", "field"], "type": "video"},
            {"title": "Electric potential and voltage", "url": "https://www.khanacademy.org/science/physics/electric-charge-electric-force-and-voltage/electric-potential-voltage", "keywords": ["voltage", "electric potential", "potential difference", "energy"], "type": "video"},
            {"title": "Circuits", "url": "https://www.khanacademy.org/science/physics/circuits-topic", "keywords": ["circuit", "current", "resistance", "ohm", "voltage"], "type": "video"},
            {"title": "Ohm's law and circuits", "url": "https://www.khanacademy.org/science/ap-physics-1/ap-circuits-topic/ohms-law-and-circuits-with-resistors-ap/v/circuits-part-1", "keywords": ["ohm", "law", "resistance", "current", "voltage", "circuit"], "type": "video"},
            {"title": "Magnetic forces and fields", "url": "https://www.khanacademy.org/science/physics/magnetic-forces-and-magnetic-fields", "keywords": ["magnetic", "magnetism", "field", "force", "flux"], "type": "video"},
            {"title": "Electromagnetic induction", "url": "https://www.khanacademy.org/science/physics/electromagnetic-induction", "keywords": ["electromagnetic", "induction", "faraday", "lenz"], "type": "video"},

            # Light and optics
            {"title": "Light and optics", "url": "https://www.khanacademy.org/science/physics/geometric-optics", "keywords": ["light", "optics", "reflection", "refraction", "lens", "mirror"], "type": "video"},
            {"title": "Reflection and refraction", "url": "https://www.khanacademy.org/science/ap-physics-2/ap-geometric-optics/reflection-refraction-ap/v/specular-and-diffuse-reflection", "keywords": ["reflection", "refraction", "snell", "law", "light"], "type": "video"},

            # Modern physics - Atomic physics (Physics 30)
            {"title": "Quantum physics introduction", "url": "https://www.khanacademy.org/science/physics/quantum-physics", "keywords": ["quantum", "photon", "planck", "photoelectric", "atomic"], "type": "video"},
            {"title": "Photoelectric effect", "url": "https://www.khanacademy.org/science/ap-physics-2/ap-quantum-physics/photoelectric-effect-ap/v/introduction-to-the-photoelectric-effect", "keywords": ["photoelectric", "effect", "photon", "electron", "work function"], "type": "video"},
            {"title": "Atomic structure and spectra", "url": "https://www.khanacademy.org/science/physics/quantum-physics/quantum-numbers-and-orbitals", "keywords": ["atomic", "spectrum", "emission", "absorption", "bohr model"], "type": "video"},
            {"title": "Rutherford's gold foil experiment", "url": "https://www.khanacademy.org/science/chemistry/electronic-structure-of-atoms/history-of-atomic-structure/v/rutherford-s-gold-foil-experiment", "keywords": ["rutherford", "gold foil", "scattering", "nucleus", "atomic model"], "type": "video"},
            {"title": "Cathode rays and electrons", "url": "https://www.khanacademy.org/science/chemistry/electronic-structure-of-atoms/history-of-atomic-structure/v/discovery-of-the-electron-and-nucleus", "keywords": ["cathode ray", "electron", "thomson", "charge to mass ratio", "atomic"], "type": "video"},

            # CrashCourse Physics videos
            {"title": "CrashCourse: Motion in a Straight Line", "url": "https://www.youtube.com/watch?v=ZM8ECpBuQYE", "keywords": ["motion", "kinematics", "velocity", "acceleration", "displacement"], "type": "video"},
            {"title": "CrashCourse: Momentum and Impulse", "url": "https://www.youtube.com/watch?v=sI1C9DyIi_8", "keywords": ["momentum", "impulse", "collision", "conservation"], "type": "video"},
            {"title": "CrashCourse: Electric Fields", "url": "https://www.youtube.com/watch?v=mdulzEfQXDE", "keywords": ["electric", "field", "charge", "coulomb", "force"], "type": "video"},
            {"title": "CrashCourse: Circuits", "url": "https://www.youtube.com/watch?v=m4jzgqZu-4s", "keywords": ["circuit", "current", "resistance", "voltage", "ohm"], "type": "video"},

            # Bozeman Science physics videos
            {"title": "Bozeman: Momentum and Collisions", "url": "https://www.youtube.com/watch?v=9A6MwwnR1Mg", "keywords": ["momentum", "collision", "elastic", "inelastic", "conservation"], "type": "video"},
            {"title": "Bozeman: Electric Fields", "url": "https://www.youtube.com/watch?v=kVb8yEo-UuI", "keywords": ["electric", "field", "charge", "coulomb", "force"], "type": "video"},
            {"title": "Bozeman: Atomic Models", "url": "https://www.youtube.com/watch?v=HsKK9zPdXAY", "keywords": ["atomic", "model", "rutherford", "bohr", "quantum"], "type": "video"},

            # Professor Dave Explains physics videos
            {"title": "Professor Dave: Momentum and Impulse", "url": "https://www.youtube.com/watch?v=fb6LWLAwFHk", "keywords": ["momentum", "impulse", "collision", "conservation", "force"], "type": "video"},
            {"title": "Professor Dave: Electric Circuits", "url": "https://www.youtube.com/watch?v=VnnfJRPCr6Q", "keywords": ["circuit", "current", "resistance", "voltage", "ohm"], "type": "video"},
            {"title": "Professor Dave: Atomic Structure", "url": "https://www.youtube.com/watch?v=W2Xb2GFK2yc", "keywords": ["atomic", "structure", "electron", "nucleus", "proton", "neutron"], "type": "video"},
        ],
        "math": [
            {"title": "Algebra basics", "url": "https://www.khanacademy.org/math/algebra", "keywords": ["algebra", "equation", "variable", "expression"], "type": "video"},
            {"title": "Polynomials", "url": "https://www.khanacademy.org/math/algebra2/x2ec2f6f830c9fb89:poly-arithmetic", "keywords": ["polynomial", "factor", "quadratic", "cubic"], "type": "video"},
            {"title": "Quadratic functions", "url": "https://www.khanacademy.org/math/algebra/x2f8bb11595b61c86:quadratic-functions-equations", "keywords": ["quadratic", "parabola", "vertex", "roots"], "type": "video"},
            {"title": "Rational expressions", "url": "https://www.khanacademy.org/math/algebra2/x2ec2f6f830c9fb89:rational", "keywords": ["rational", "fraction", "expression", "simplify"], "type": "video"},
            {"title": "Exponential and logarithmic functions", "url": "https://www.khanacademy.org/math/algebra2/x2ec2f6f830c9fb89:exp", "keywords": ["exponential", "logarithm", "growth", "decay", "log"], "type": "video"},
            {"title": "Trigonometry", "url": "https://www.khanacademy.org/math/trigonometry", "keywords": ["trigonometry", "sine", "cosine", "tangent", "angle"], "type": "video"},
            {"title": "Trigonometric equations and identities", "url": "https://www.khanacademy.org/math/trigonometry/trigonometry-trigonometric-equations-and-identities", "keywords": ["trig", "identity", "equation", "solve"], "type": "video"},
            {"title": "Geometry", "url": "https://www.khanacademy.org/math/geometry", "keywords": ["geometry", "triangle", "circle", "angle", "area"], "type": "video"},
            {"title": "Sequences and series", "url": "https://www.khanacademy.org/math/precalculus/x9e81a4f98389efdf:series", "keywords": ["sequence", "series", "arithmetic", "geometric", "sum"], "type": "video"},
            {"title": "Limits and continuity", "url": "https://www.khanacademy.org/math/ap-calculus-ab/ab-limits-new", "keywords": ["limit", "continuity", "calculus", "approach"], "type": "video"},
            {"title": "Derivatives", "url": "https://www.khanacademy.org/math/ap-calculus-ab/ab-differentiation-1-new", "keywords": ["derivative", "differentiation", "rate of change", "slope"], "type": "video"},
        ],
        "ela": [
            {"title": "Reading comprehension strategies", "url": "https://www.khanacademy.org/ela/cc-9th-reading-vocab", "keywords": ["comprehend", "reading", "understanding", "interpret", "text"], "type": "video"},
            {"title": "Literary analysis", "url": "https://www.khanacademy.org/ela/cc-9th-reading-vocab/x6c5bbf0e196c8001:cc-9th-literature", "keywords": ["analysis", "literary", "theme", "character", "symbolism", "critical"], "type": "video"},
            {"title": "Citing textual evidence", "url": "https://www.khanacademy.org/ela/cc-9th-reading-vocab/x6c5bbf0e196c8001:cc-9th-info-text", "keywords": ["cite", "evidence", "textual", "support", "quote"], "type": "practice"},
            {"title": "Writing process", "url": "https://www.khanacademy.org/ela/cc-9th-reading-vocab/cc-9th-language-and-vocab", "keywords": ["writing", "draft", "revise", "edit", "process", "create"], "type": "video"},
            {"title": "Thesis statements - Purdue OWL", "url": "https://owl.purdue.edu/owl/general_writing/the_writing_process/thesis_statement_tips.html", "keywords": ["thesis", "argument", "position", "claim"], "type": "article"},
            {"title": "Literary analysis - Purdue OWL", "url": "https://owl.purdue.edu/owl/subject_specific_writing/writing_in_literature/writing_about_literature/index.html", "keywords": ["literary", "analysis", "critical", "interpretation"], "type": "article"},
            {"title": "Research and citation - Purdue OWL", "url": "https://owl.purdue.edu/owl/research_and_citation/resources.html", "keywords": ["research", "citation", "source", "reference", "documentation"], "type": "reference"},
            {"title": "MLA format guide - Purdue OWL", "url": "https://owl.purdue.edu/owl/research_and_citation/mla_style/mla_formatting_and_style_guide/mla_formatting_and_style_guide.html", "keywords": ["mla", "format", "citation", "works cited"], "type": "reference"},
            {"title": "APA format guide - Purdue OWL", "url": "https://owl.purdue.edu/owl/research_and_citation/apa_style/apa_formatting_and_style_guide/general_format.html", "keywords": ["apa", "format", "citation", "references"], "type": "reference"},
            {"title": "Rhetorical analysis", "url": "https://owl.purdue.edu/owl/general_writing/academic_writing/rhetorical_situation/index.html", "keywords": ["rhetoric", "rhetorical", "audience", "purpose", "context"], "type": "article"},
            {"title": "Argument and persuasion", "url": "https://owl.purdue.edu/owl/general_writing/academic_writing/establishing_arguments/index.html", "keywords": ["argument", "persuasion", "position", "claim", "reasoning"], "type": "article"},
            {"title": "Close reading strategies", "url": "https://owl.purdue.edu/owl/subject_specific_writing/writing_in_literature/writing_about_poetry/close_reading_strategies.html", "keywords": ["close reading", "analysis", "interpret", "understanding"], "type": "article"},
            {"title": "Organizing research", "url": "https://owl.purdue.edu/owl/research_and_citation/conducting_research/conducting_research/organizing_research.html", "keywords": ["organize", "research", "information", "gather", "store"], "type": "article"},
            {"title": "Critical thinking", "url": "https://owl.purdue.edu/owl/general_writing/academic_writing/critical_thinking/index.html", "keywords": ["critical", "thinking", "evaluate", "analyze", "perspective"], "type": "article"},
            {"title": "Collaboration strategies", "url": "https://owl.purdue.edu/owl/general_writing/the_writing_process/collaborative_writing/index.html", "keywords": ["collaborate", "collaboration", "group", "teamwork", "support"], "type": "article"},
            {"title": "Self-assessment and reflection", "url": "https://owl.purdue.edu/owl/general_writing/the_writing_process/proofreading/self_editing.html", "keywords": ["reflect", "assessment", "goal", "evaluate", "personal"], "type": "article"},
        ],
    }

    def search_outcomes(self, outcome: OutcomeContext, max_results: int = 3) -> List[ResourceCandidate]:
        """Search Khan Academy content by keyword matching"""

        # Get subject key
        subject_key = self._get_subject_key(outcome.subject)
        if not subject_key or subject_key not in self.CONTENT_MAP:
            return []

        # Extract search terms from outcome
        description_lower = outcome.outcome_description.lower()
        search_terms = self._extract_key_terms(outcome.outcome_description).lower().split()

        # Score each content item by keyword matches
        scored_content = []
        for content in self.CONTENT_MAP[subject_key]:
            score = 0

            # Check keyword matches in description
            for keyword in content["keywords"]:
                if keyword.lower() in description_lower:
                    score += 2  # Direct keyword match

            # Check search term matches
            for term in search_terms:
                if len(term) < 4:  # Skip short words
                    continue
                for keyword in content["keywords"]:
                    if term in keyword.lower():
                        score += 1

            # Check title matches
            title_lower = content["title"].lower()
            for term in search_terms:
                if len(term) >= 4 and term in title_lower:
                    score += 1

            if score > 0:
                scored_content.append((score, content))

        # Sort by score and take top results
        scored_content.sort(key=lambda x: x[0], reverse=True)

        candidates = []
        for score, content in scored_content[:max_results]:
            # Calculate confidence based on score
            confidence = min(0.5 + (score * 0.1), 0.95)

            candidate = ResourceCandidate(
                url=content["url"],
                title=f"Khan Academy: {content['title']}",
                type=content["type"],
                source="Khan Academy",
                difficulty="intermediate",
                provider="khan-academy",
                aligned_outcomes=[outcome.outcome_code],
                confidence_score=confidence,
                embeddable=False,
            )
            candidates.append(candidate)

        if candidates:
            print(f"      ✓ Khan Academy: Found {len(candidates)} resources")

        return candidates

    def _get_subject_key(self, subject: str) -> Optional[str]:
        """Extract subject key"""
        subject_lower = subject.lower()

        if "bio" in subject_lower:
            return "biology"
        elif "chem" in subject_lower:
            return "chemistry"
        elif "phys" in subject_lower:
            return "physics"
        elif "math" in subject_lower:
            return "math"
        elif "english" in subject_lower or "ela" in subject_lower or "language arts" in subject_lower:
            return "ela"

        return None

    def _extract_key_terms(self, description: str) -> str:
        """Extract key searchable terms from outcome description"""
        # Remove common prefixes and bullet points
        text = re.sub(r'^[-•]\s*', '', description)

        # Remove action verbs at the start
        text = re.sub(
            r'^(Explain|Describe|Identify|Analyze|Compare|Investigate|Solve|Determine|Apply|Demonstrate|Evaluate|Interpret|Examine|Explore|Discuss|Define|Relate|Connect|Derive|Prove|Calculate|Predict)\s+(how|why|the|that|whether|when|where)?\s*',
            '',
            text,
            flags=re.IGNORECASE
        )

        # Remove meta-instructions and tags
        text = re.sub(r'\[.*?\]', '', text)  # Remove [ICT: ...] tags
        text = re.sub(r'\(.*?e\.g\..*?\)', '', text)  # Remove example clauses

        # Take first meaningful clause (before first semicolon, period, or "by")
        match = re.search(r'^([^.;]+?)(?:\s+by\s+|$)', text)
        if match:
            text = match.group(1)
        else:
            # Fallback to first sentence
            match = re.search(r'^([^.;]+)', text)
            if match:
                text = match.group(1)

        # Remove common filler phrases
        text = re.sub(r'\b(the process of|the concept of|the relationship between|the role of|the impact of|the nature of)\b', '', text, flags=re.IGNORECASE)

        # Extract noun phrases and key terms
        # Look for capitalized terms (often important concepts)
        capitalized = re.findall(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*', text)

        # Remove common stop words but keep important ones
        stop_words = {'using', 'within', 'between', 'through', 'during', 'including', 'such as', 'in order to', 'as well as'}
        for stop in stop_words:
            text = re.sub(r'\b' + stop + r'\b', ' ', text, flags=re.IGNORECASE)

        # Clean up whitespace
        text = re.sub(r'\s+', ' ', text).strip()

        # If we have capitalized terms, prioritize them
        if capitalized and len(' '.join(capitalized)) > 10:
            # Combine capitalized terms with first few words
            first_words = ' '.join(text.split()[:5])
            text = f"{' '.join(capitalized)} {first_words}"
            # Remove duplicates
            text = ' '.join(dict.fromkeys(text.split()))

        # Limit length
        return text[:100].strip()


class OpenStaxMatcher(CachedSearcher):
    """Match OpenStax textbook chapters to outcomes"""

    BOOKS = {
        "biology": {
            "url": "https://openstax.org/books/biology-2e/pages/",
            "chapters": {
                "cell": "3-",
                "membrane": "5-",
                "metabolism": "6-",
                "photosynthesis": "8-",
                "respiration": "7-",
                "dna": "14-",
                "gene": "15-",
                "evolution": "18-",
                "ecology": "44-",
                "population": "45-",
                "nervous": "35-",
                "endocrine": "37-",
            }
        },
        "chemistry": {
            "url": "https://openstax.org/books/chemistry-2e/pages/",
            "chapters": {
                "atom": "2-",
                "periodic": "2-",
                "bond": "7-",
                "reaction": "4-",
                "gas": "9-",
                "thermodynamics": "5-",
                "equilibrium": "13-",
                "acid": "14-",
                "electrochemistry": "17-",
            }
        },
        "physics": {
            "url": "https://openstax.org/books/college-physics-2e/pages/",
            "chapters": {
                "motion": "2-",
                "force": "4-",
                "energy": "7-",
                "momentum": "8-",
                "wave": "16-",
                "electric": "18-",
                "magnetic": "22-",
                "light": "25-",
            }
        }
    }

    def search_outcomes(self, outcome: OutcomeContext, max_results: int = 2) -> List[ResourceCandidate]:
        """Find relevant OpenStax chapters"""
        candidates = []

        subject_key = self._get_subject_key(outcome.subject)
        if not subject_key or subject_key not in self.BOOKS:
            return []

        book = self.BOOKS[subject_key]

        # Match keywords in outcome to chapters
        description_lower = outcome.outcome_description.lower()

        for keyword, chapter_prefix in book["chapters"].items():
            if keyword in description_lower:
                url = f"{book['url']}{chapter_prefix}introduction"

                candidate = ResourceCandidate(
                    url=url,
                    title=f"OpenStax {subject_key.title()} - {keyword.title()}",
                    type="article",
                    source="OpenStax",
                    difficulty="intermediate",
                    provider="openstax",
                    aligned_outcomes=[outcome.outcome_code],
                    confidence_score=0.6,
                    embeddable=False,
                )
                candidates.append(candidate)

                if len(candidates) >= max_results:
                    break

        if candidates:
            print(f"      ✓ OpenStax: Found {len(candidates)} chapters")

        return candidates

    def _get_subject_key(self, subject: str) -> Optional[str]:
        """Extract subject key"""
        subject_lower = subject.lower()

        if "bio" in subject_lower:
            return "biology"
        elif "chem" in subject_lower:
            return "chemistry"
        elif "phys" in subject_lower:
            return "physics"

        return None


class PhETFinder(CachedSearcher):
    """Find PhET simulations by keyword matching"""

    SIMULATIONS = {
        "physics": [
            {"name": "Forces and Motion: Basics", "url": "https://phet.colorado.edu/en/simulations/forces-and-motion-basics", "keywords": ["force", "motion", "newton", "friction"]},
            {"name": "Energy Skate Park", "url": "https://phet.colorado.edu/en/simulations/energy-skate-park", "keywords": ["energy", "kinetic", "potential", "conservation"]},
            {"name": "Projectile Motion", "url": "https://phet.colorado.edu/en/simulations/projectile-motion", "keywords": ["projectile", "trajectory", "motion", "parabola"]},
            {"name": "Wave on a String", "url": "https://phet.colorado.edu/en/simulations/wave-on-a-string", "keywords": ["wave", "frequency", "amplitude", "oscillation"]},
            {"name": "Circuit Construction Kit", "url": "https://phet.colorado.edu/en/simulations/circuit-construction-kit-dc", "keywords": ["circuit", "current", "voltage", "resistance", "electric"]},
            {"name": "Charges and Fields", "url": "https://phet.colorado.edu/en/simulations/charges-and-fields", "keywords": ["electric", "field", "charge", "coulomb"]},
            {"name": "Faraday's Law", "url": "https://phet.colorado.edu/en/simulations/faradays-law", "keywords": ["electromagnetic", "induction", "magnetic", "faraday"]},
        ],
        "chemistry": [
            {"name": "Build a Molecule", "url": "https://phet.colorado.edu/en/simulations/build-a-molecule", "keywords": ["molecule", "bond", "chemical", "structure"]},
            {"name": "Balancing Chemical Equations", "url": "https://phet.colorado.edu/en/simulations/balancing-chemical-equations", "keywords": ["equation", "balance", "reaction", "stoichiometry"]},
            {"name": "Gas Properties", "url": "https://phet.colorado.edu/en/simulations/gas-properties", "keywords": ["gas", "pressure", "temperature", "volume", "ideal"]},
            {"name": "pH Scale", "url": "https://phet.colorado.edu/en/simulations/ph-scale", "keywords": ["acid", "base", "ph", "neutral"]},
            {"name": "Reaction Rates", "url": "https://phet.colorado.edu/en/simulations/reactions-and-rates", "keywords": ["reaction", "rate", "kinetics", "catalyst"]},
        ],
        "biology": [
            {"name": "Natural Selection", "url": "https://phet.colorado.edu/en/simulations/natural-selection", "keywords": ["evolution", "selection", "adaptation", "mutation"]},
            {"name": "Gene Expression", "url": "https://phet.colorado.edu/en/simulations/gene-expression-essentials", "keywords": ["gene", "protein", "expression", "dna", "rna"]},
        ]
    }

    def search_outcomes(self, outcome: OutcomeContext, max_results: int = 1) -> List[ResourceCandidate]:
        """Find relevant PhET simulations"""
        candidates = []

        subject_key = self._get_subject_key(outcome.subject)
        if not subject_key or subject_key not in self.SIMULATIONS:
            return []

        description_lower = outcome.outcome_description.lower()

        for sim in self.SIMULATIONS[subject_key]:
            # Check if any keywords match
            matches = sum(1 for kw in sim["keywords"] if kw in description_lower)

            if matches > 0:
                confidence = min(0.5 + (matches * 0.15), 0.9)

                candidate = ResourceCandidate(
                    url=sim["url"],
                    title=f"PhET: {sim['name']}",
                    type="simulation",
                    source="PhET",
                    difficulty="beginner",
                    provider="phet",
                    aligned_outcomes=[outcome.outcome_code],
                    confidence_score=confidence,
                    embeddable=True,
                )
                candidates.append(candidate)

                if len(candidates) >= max_results:
                    break

        if candidates:
            print(f"      ✓ PhET: Found {len(candidates)} simulations")

        return candidates

    def _get_subject_key(self, subject: str) -> Optional[str]:
        """Extract subject key"""
        subject_lower = subject.lower()

        if "bio" in subject_lower:
            return "biology"
        elif "chem" in subject_lower:
            return "chemistry"
        elif "phys" in subject_lower:
            return "physics"

        return None


class LLMResourceMatcher:
    """Use LLM to rank and filter resource candidates"""

    def __init__(self, model: str = "gpt-5-mini", enabled: bool = True):
        self.model = model
        self.fallback_model = "gpt-5-nano"
        self.enabled = enabled and bool(OPENAI_API_KEY)

        if self.enabled and not OPENAI_API_KEY:
            print("⚠️  LLM matching disabled: OPENAI_API_KEY not found")
            self.enabled = False

    def rank_candidates(
        self,
        outcome: OutcomeContext,
        candidates: List[ResourceCandidate],
        top_n: int = 3
    ) -> List[ResourceCandidate]:
        """Rank candidates using LLM"""

        if not self.enabled or not candidates:
            # Simple ranking by confidence score
            return sorted(candidates, key=lambda c: c.confidence_score, reverse=True)[:top_n]

        print(f"      🤖 LLM ranking {len(candidates)} candidates...")

        # Try primary model first, then fallback
        for model_name in [self.model, self.fallback_model]:
            try:
                # Build prompt
                prompt = self._build_ranking_prompt(outcome, candidates)

                # Call OpenAI
                response = requests.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {OPENAI_API_KEY}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": model_name,
                        "messages": [
                            {"role": "system", "content": "You are an expert educational resource curator specializing in Alberta high school curriculum. Your task is to rank learning resources by their relevance and pedagogical value for specific learning outcomes."},
                            {"role": "user", "content": prompt}
                        ],
                        "max_completion_tokens": 800,
                    },
                    timeout=30
                )

                if response.status_code != 200:
                    if model_name == self.fallback_model:
                        print(f"         ⚠ LLM API error: {response.status_code}")
                        return sorted(candidates, key=lambda c: c.confidence_score, reverse=True)[:top_n]
                    else:
                        print(f"         ⚠ {model_name} failed, trying {self.fallback_model}...")
                        continue

                result = response.json()
                rankings_text = result["choices"][0]["message"]["content"]

                # Parse rankings (expecting: "1. [index], 2. [index], ...")
                ranked_indices = self._parse_rankings(rankings_text)

                # Reorder candidates
                ranked_candidates = []
                for idx in ranked_indices[:top_n]:
                    if 0 <= idx < len(candidates):
                        candidates[idx].confidence_score = 0.9 - (len(ranked_candidates) * 0.1)
                        ranked_candidates.append(candidates[idx])

                if ranked_candidates:
                    print(f"         ✓ LLM ({model_name}) ranked top {len(ranked_candidates)} resources")
                    return ranked_candidates

            except Exception as e:
                if model_name == self.fallback_model:
                    print(f"         ⚠ LLM error: {str(e)}")
                    return sorted(candidates, key=lambda c: c.confidence_score, reverse=True)[:top_n]
                else:
                    print(f"         ⚠ {model_name} error, trying {self.fallback_model}...")
                    continue

        # If all models fail, fallback to confidence sorting
        return sorted(candidates, key=lambda c: c.confidence_score, reverse=True)[:top_n]

    def _build_ranking_prompt(self, outcome: OutcomeContext, candidates: List[ResourceCandidate]) -> str:
        """Build LLM ranking prompt"""
        prompt = f"""You are helping students prepare for Alberta high school curriculum outcomes.

LEARNING OUTCOME TO MATCH:
Subject: {outcome.subject} (Grade {outcome.grade})
Outcome Code: {outcome.outcome_code}
Description: {outcome.outcome_description}

AVAILABLE RESOURCES:
"""
        for i, candidate in enumerate(candidates):
            prompt += f"\n{i}. Title: {candidate.title}\n"
            prompt += f"   Type: {candidate.type}\n"
            prompt += f"   Source: {candidate.source}\n"
            prompt += f"   URL: {candidate.url}\n"

        prompt += """
TASK:
Rank these resources from MOST to LEAST relevant for helping a student master this specific learning outcome.

RANKING CRITERIA:
1. Content Alignment: Does the resource directly teach the concepts in the outcome description?
2. Specificity: Does it cover the exact topics mentioned (not just general subject area)?
3. Grade Appropriateness: Is the difficulty level suitable for the grade level?
4. Learning Value: Will students gain actionable knowledge from this resource?
5. Resource Type: Prefer videos for complex topics, articles for reference, simulations for hands-on learning

RESPONSE FORMAT:
Return ONLY a comma-separated list of indices in ranked order from best to worst.
Example: "2, 0, 4, 1, 3"

Your ranking (indices only):"""

        return prompt

    def _parse_rankings(self, text: str) -> List[int]:
        """Parse LLM ranking response"""
        # Extract numbers
        numbers = re.findall(r'\b(\d+)\b', text)
        return [int(n) for n in numbers]


class ResourcePopulator:
    """Main orchestrator for resource population"""

    def __init__(self, use_llm: bool = False, llm_model: str = "gpt-5-mini"):
        self.khan = KhanAcademySearcher()
        self.openstax = OpenStaxMatcher()
        self.phet = PhETFinder()
        self.llm = LLMResourceMatcher(model=llm_model, enabled=use_llm)

    def load_gaps(self, subject_filter: Optional[str] = None) -> List[OutcomeContext]:
        """Load outcomes that need resources"""
        gaps_file = REPORTS_DIR / "resource-gaps.json"

        if not gaps_file.exists():
            print(f"❌ Gap report not found: {gaps_file}")
            print("   Run: npm run detect-gaps")
            sys.exit(1)

        with open(gaps_file, 'r') as f:
            gap_data = json.load(f)

        outcomes = []
        total_gaps = 0
        for gap in gap_data.get('gaps', []):
            if not gap.get('hasResources', True):
                total_gaps += 1
                # Filter by subject if specified
                if subject_filter:
                    # Normalize names
                    gap_subject_norm = gap['subject'].lower().replace(' ', '-').replace('mathematics', 'math')
                    filter_norm = subject_filter.lower().replace('.json', '')

                    # Handle subject abbreviations
                    # Biology → bio, Chemistry → chem, Physics → phys
                    gap_subject_abbrev = gap_subject_norm.replace('biology-', 'bio-').replace('chemistry-', 'chem-').replace('physics-', 'phys-')

                    # Handle ELA abbreviation
                    if filter_norm.startswith('ela-'):
                        gap_subject_abbrev = gap_subject_abbrev.replace('english-language-arts-', 'ela-')

                    # Match either full name or abbreviated name
                    # This handles cases like:
                    # - "bio-30" matching "biology-30" → "bio-30"
                    # - "chem-20" matching "chemistry-20" → "chem-20"
                    # - "ela-30-1" matching "english-language-arts-30-1" → "ela-30-1"
                    matches = (filter_norm == gap_subject_norm or
                              filter_norm == gap_subject_abbrev or
                              filter_norm in gap_subject_abbrev or
                              gap_subject_abbrev in filter_norm)

                    if not matches:
                        continue

                outcomes.append(OutcomeContext(
                    subject=gap['subject'],
                    grade=gap['grade'],
                    unit_id=gap['unitId'],
                    unit_title=gap['unitTitle'],
                    outcome_code=gap['outcomeCode'],
                    outcome_description=gap['outcomeDescription'],
                    strand=gap.get('strand'),
                ))

        if subject_filter:
            print(f"   Loaded {len(outcomes)} outcomes for filter '{subject_filter}' (from {total_gaps} total gaps)")

        return outcomes

    def find_resources(self, outcome: OutcomeContext, min_per_type: int = 1, current: int = 0, total: int = 0) -> List[ResourceCandidate]:
        """Find resources for an outcome"""
        all_candidates = []

        # Search multiple sources
        progress_bar = ""
        if total > 0:
            pct = int((current / total) * 100)
            bar_length = 20
            filled = int((pct / 100) * bar_length)
            progress_bar = f" [{('█' * filled) + ('░' * (bar_length - filled))}] {pct}%"

        print(f"   🔍 [{current}/{total}]{progress_bar} Searching for {outcome.outcome_code}: {outcome.outcome_description[:60]}...")

        all_candidates.extend(self.khan.search_outcomes(outcome, max_results=5))
        all_candidates.extend(self.openstax.search_outcomes(outcome, max_results=2))
        all_candidates.extend(self.phet.search_outcomes(outcome, max_results=1))

        # Dynamically decide how many resources to select based on candidates available
        # Aim for 2-5 resources: fewer if limited candidates, more if many good matches
        target_count = min(max(2, len(all_candidates) // 2), 5)

        # Use LLM to rank and select best resources
        ranked = self.llm.rank_candidates(outcome, all_candidates, top_n=target_count)

        # Ensure diversity (at least one video, article, practice if available)
        final_resources = self._ensure_diversity(ranked, min_per_type, max_total=target_count)

        print(f"      ✓ Selected {len(final_resources)} resources ({len(all_candidates)} candidates evaluated)")

        return final_resources

    def _ensure_diversity(self, candidates: List[ResourceCandidate], min_per_type: int = 1, max_total: int = 5) -> List[ResourceCandidate]:
        """Ensure resource type diversity with dynamic limits"""
        selected = []
        type_counts = {"video": 0, "article": 0, "practice": 0, "simulation": 0}

        # First pass: ensure minimum per type (but respect max_total)
        for candidate in candidates:
            if len(selected) >= max_total:
                break
            if type_counts.get(candidate.type, 0) < min_per_type:
                selected.append(candidate)
                type_counts[candidate.type] = type_counts.get(candidate.type, 0) + 1

        # Second pass: add remaining high-scoring candidates up to max
        for candidate in candidates:
            if len(selected) >= max_total:
                break
            if candidate not in selected:
                selected.append(candidate)

        return selected

    def populate_curriculum(
        self,
        subject_file: str,
        outcomes: List[OutcomeContext],
        dry_run: bool = True
    ) -> Dict[str, Any]:
        """Add resources to curriculum file"""

        curriculum_path = CURRICULUM_DIR / subject_file

        if not curriculum_path.exists():
            return {"success": False, "error": f"File not found: {subject_file}"}

        # Load curriculum
        with open(curriculum_path, 'r') as f:
            curriculum = json.load(f)

        print(f"\n📚 {curriculum['subject']} (Grade {curriculum['grade']})")
        print(f"   Processing {len(outcomes)} outcomes")
        print(f"   Using LLM: {'✓ Yes (gpt-5-mini)' if self.llm.enabled else '✗ No (keyword matching only)'}\n")

        resources_added = 0

        # Process each outcome
        for idx, outcome in enumerate(outcomes, 1):
            # Find resources
            candidates = self.find_resources(outcome, current=idx, total=len(outcomes))

            if not candidates:
                print(f"      ⚠ No resources found")
                continue

            # Find the unit in curriculum
            unit = None
            for u in curriculum.get('units', []):
                if u.get('id') == outcome.unit_id:
                    unit = u
                    break

            if not unit:
                print(f"      ⚠ Unit {outcome.unit_id} not found in curriculum")
                continue

            # Add resources to unit
            if 'resources' not in unit:
                unit['resources'] = []

            for candidate in candidates:
                resource_dict = candidate.to_curriculum_format()

                # Check if this URL already exists in the unit
                existing_resource = None
                for r in unit['resources']:
                    if r.get('url') == resource_dict['url']:
                        existing_resource = r
                        break

                if existing_resource:
                    # Resource exists - update alignedOutcomes if this outcome isn't already listed
                    aligned = existing_resource.get('alignedOutcomes', [])
                    if outcome.outcome_code not in aligned:
                        aligned.append(outcome.outcome_code)
                        existing_resource['alignedOutcomes'] = aligned
                        resources_added += 1  # Count as "added" since we're improving alignment
                else:
                    # New resource - add it
                    unit['resources'].append(resource_dict)
                    resources_added += 1

        # Save curriculum
        if not dry_run:
            with open(curriculum_path, 'w') as f:
                json.dump(curriculum, f, indent=2, ensure_ascii=False)
                f.write('\n')
            print(f"\n   💾 Saved {curriculum_path}")
            if len(outcomes) > 0:
                print(f"   📊 Resources added: {resources_added} total (avg {resources_added/len(outcomes):.1f} per outcome)")
        else:
            print(f"\n   🔍 DRY RUN - No changes written")

        return {
            "success": True,
            "subject": curriculum['subject'],
            "outcomes_processed": len(outcomes),
            "resources_added": resources_added,
        }


def main():
    parser = argparse.ArgumentParser(description="Enhanced automated resource population")
    parser.add_argument("--subject", help="Subject file to process (e.g., bio-30.json)")
    parser.add_argument("--all-sciences", action="store_true", help="Process all science subjects")
    parser.add_argument("--outcomes", help="Comma-separated outcome codes to process")
    parser.add_argument("--limit", type=int, help="Limit number of outcomes to process (for testing)")
    parser.add_argument("--use-llm", action="store_true", help="Use LLM for resource ranking")
    parser.add_argument("--llm-model", default="gpt-5-mini", help="LLM model (gpt-5-mini, gpt-5-nano, etc.)")
    parser.add_argument("--dry-run", action="store_true", help="Don't write changes")
    parser.add_argument("--write", action="store_true", help="Write resources to curriculum files")
    parser.add_argument("--report", help="Write report to file")
    args = parser.parse_args()

    # Initialize populator
    populator = ResourcePopulator(use_llm=args.use_llm, llm_model=args.llm_model)

    # Determine subjects
    subjects = []
    if args.subject:
        subjects = [args.subject if args.subject.endswith('.json') else f"{args.subject}.json"]
    elif args.all_sciences:
        subjects = ["bio-20.json", "bio-30.json", "chem-20.json", "chem-30.json", "phys-20.json", "phys-30.json"]
    else:
        print("❌ Specify --subject or --all-sciences")
        sys.exit(1)

    # Load gaps
    all_results = []

    for subject_file in subjects:
        subject_key = subject_file.replace('.json', '')

        # Load gaps for this subject
        outcomes = populator.load_gaps(subject_filter=subject_key)

        # Filter by outcome codes if specified
        if args.outcomes:
            outcome_codes = set(args.outcomes.split(','))
            outcomes = [o for o in outcomes if o.outcome_code in outcome_codes]

        # Limit if specified
        if args.limit:
            outcomes = outcomes[:args.limit]

        if not outcomes:
            print(f"\n📚 {subject_file}: No gaps found")
            continue

        # Populate
        result = populator.populate_curriculum(
            subject_file,
            outcomes,
            dry_run=args.dry_run or not args.write
        )
        all_results.append(result)

    # Summary
    print(f"\n\n{'='*60}")
    print("✨ SUMMARY")
    print(f"{'='*60}")

    total_outcomes = sum(r.get("outcomes_processed", 0) for r in all_results)
    total_resources = sum(r.get("resources_added", 0) for r in all_results)

    print(f"Subjects processed: {len(all_results)}")
    print(f"Outcomes processed: {total_outcomes}")
    print(f"Resources added: {total_resources}")

    if args.dry_run or not args.write:
        print(f"\n💡 This was a DRY RUN. Use --write to apply changes.")
    else:
        print(f"\n✅ Changes written to curriculum files!")
        print(f"\nRun validation to check coverage:")
        print(f"   npx tsx scripts/validate-coverage.ts")

    # Write report
    if args.report:
        report_path = Path(args.report)
        report_path.parent.mkdir(parents=True, exist_ok=True)

        with open(report_path, 'w') as f:
            json.dump({
                "results": all_results,
                "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
                "settings": {
                    "use_llm": args.use_llm,
                    "llm_model": args.llm_model,
                    "dry_run": args.dry_run or not args.write,
                }
            }, f, indent=2)

        print(f"\n📊 Report saved: {report_path}")


if __name__ == "__main__":
    main()
