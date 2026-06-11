#!/usr/bin/env python3
"""
Clean extracted chunks and align them to Alberta curriculum outcomes.

Inputs:
  - Extracted chunks per document: data/extracted/<doc-stem>/chunks.jsonl
  - Parsed curriculum outcomes: data/sources/alberta/parsed/*.json

Outputs:
  - data/clean/<doc-stem>/clean_chunks.jsonl  (noise-filtered, normalized chunks)
  - data/clean/<doc-stem>/doc_clean.md        (coherent Markdown assembled from cleaned chunks)
  - data/alignment/<subject>.json             (alignment results per subject)

Alignment method:
  - Simple TF-IDF cosine similarity (no external deps)
  - Tokenization with lowercase + basic stopword removal
  - For each outcome, rank top-K chunks from docs of the same subject
  - Provide small, coherent snippets (top 2 sentences by outcome-term overlap)

Run examples:
  - Clean all docs:      python3 scripts/clean_align_curriculum.py --clean
  - Align a subject:     python3 scripts/clean_align_curriculum.py --align biology --top-k 5
  - Clean + align all:   python3 scripts/clean_align_curriculum.py --clean --align-all
"""

import argparse
import json
import math
import os
import re
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple


EXTRACTED_ROOT = Path("data/extracted")
ALBERTA_PARSED = Path("data/sources/alberta/parsed")
CLEAN_ROOT = Path("data/clean")
ALIGN_ROOT = Path("data/alignment")


STOPWORDS = set(
    """
    a an and are as at be but by for from how i if in into is it its of on or that the their then there these they this to what when where which who why will with your you we our was were can may should would could also more most much such not no than about across after again against all almost along already although always among amount anoth any appear applied applies around ask asked asking because been being between both came come comes consider considered considering contain contains couldn’t couldn’t do does doesn’t doing don’t done each either enough even ever every few find first further get got had has have having here however into just keep kept large later least less like likely many may maybe might mostly must near need needs never new next none nor not now often once only other others over per perhaps rather same see seem seemed seeming seems seen shall since small some someone something sometimes still such take taken than that that’s the their them themselves then there therefore these they think those through thus try trying under until upon use used using very via was wasn’t way ways well were weren’t what’s when where whether which while who whom whose why will won’t within without won would wouldn’t year years
    """.split()
)


NOISE_PATTERNS = [
    re.compile(r"copyright protected", re.I),
    re.compile(r"castle\s+rock\s+research", re.I),
    re.compile(r"not for reproduction", re.I),
    re.compile(r"university of alberta|faculty of (science|engineering)", re.I),
    re.compile(r"www\.[a-z0-9\-\.]+", re.I),
]


SUBJECT_KEYS = [
    (re.compile(r"^english\b", re.I), "english"),
    (re.compile(r"^social-studies\b|^social\b", re.I), "social"),
    (re.compile(r"^biology\b", re.I), "biology"),
    (re.compile(r"^chemistry\b", re.I), "chemistry"),
    (re.compile(r"^physics\b", re.I), "physics"),
    (re.compile(r"^math\b|^mathematics\b", re.I), "math"),
]


@dataclass
class Chunk:
    doc: str
    doc_stem: str
    heading: Optional[str]
    text: str
    pages: List[int]
    char_count: int


def subject_from_doc_stem(stem: str) -> str:
    for pat, sub in SUBJECT_KEYS:
        if pat.search(stem):
            return sub
    return "general"


def load_chunks_for_doc(doc_stem: str) -> List[Chunk]:
    path = EXTRACTED_ROOT / doc_stem / "chunks.jsonl"
    chunks: List[Chunk] = []
    if not path.exists():
        return chunks
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        j = json.loads(line)
        chunks.append(
            Chunk(
                doc=j.get("doc", doc_stem + ".pdf"),
                doc_stem=doc_stem,
                heading=j.get("heading"),
                text=j.get("text", ""),
                pages=j.get("pages", []),
                char_count=int(j.get("char_count", len(j.get("text", "")))),
            )
        )
    return chunks


def alpha_ratio(s: str) -> float:
    if not s:
        return 0.0
    letters = sum(ch.isalpha() for ch in s)
    return letters / max(1, len(s))


def line_is_noise(line: str) -> bool:
    if not line or len(line.strip()) <= 1:
        return True
    if alpha_ratio(line) < 0.35 and not re.search(r"[A-Za-z]{3,}", line):
        return True
    # Single-token lines are almost always noise unless clearly a title/word
    toks = line.strip().split()
    if len(toks) == 1:
        w = toks[0]
        # drop if short or weird casing (keep all-caps acronyms with >=3 chars)
        if (len(w) < 8 and not w.isupper()) or not w.isalpha():
            return True
    return False


def filter_noise_text(text: str) -> str:
    lines = [l.rstrip() for l in text.splitlines()]
    out: List[str] = []
    for l in lines:
        # Drop common noise patterns
        low = l.lower()
        if any(p.search(low) for p in NOISE_PATTERNS):
            continue
        # Remove isolated page numbers and junk lines
        if line_is_noise(l):
            continue
        out.append(l)
    # Merge hyphenated breaks (already reduced in extraction, but safe)
    joined = "\n".join(out)
    joined = re.sub(r"-\n([a-z])", r"\1", joined)
    # Normalize whitespace
    joined = re.sub(r"\n{3,}", "\n\n", joined)
    return joined.strip()


def clean_chunks(chunks: List[Chunk], min_chars: int = 200) -> List[Chunk]:
    cleaned: List[Chunk] = []
    for c in chunks:
        # Skip front-matter in many KEY books (publisher pages, ads, etc.)
        if "key" in c.doc_stem and c.pages:
            if min(c.pages) <= 4:
                # Keep if it looks like real content (table/correlations) or long paragraph
                keep_heading = bool(c.heading and re.search(r"table of correlations|contents|introduction", c.heading, re.I))
                if not keep_heading and c.char_count < max(min_chars, 400):
                    continue
        # Quickly drop tiny or ad-like chunks
        if c.char_count < min_chars:
            # allow small if looks like a proper heading and next chunk likely body
            if not (c.heading and len(c.heading.split()) >= 2 and len(c.heading) <= 80):
                continue
        txt = filter_noise_text(c.text)
        if not txt:
            continue
        # if largely non-alpha after filtering, skip
        if alpha_ratio(txt) < 0.5 and len(re.findall(r"[A-Za-z]{4,}", txt)) < 10:
            continue
        cleaned.append(Chunk(doc=c.doc, doc_stem=c.doc_stem, heading=c.heading, text=txt, pages=c.pages, char_count=len(txt)))
    return cleaned


def chunks_to_markdown(doc_stem: str, chunks: List[Chunk]) -> str:
    parts: List[str] = [f"# {doc_stem}"]
    for c in chunks:
        if c.heading:
            parts.append(f"\n## {c.heading}\n")
        parts.append(c.text)
    return "\n\n".join(parts) + "\n"


def tokenize(text: str) -> List[str]:
    text = text.lower()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    toks = [t for t in text.split() if t and t not in STOPWORDS and not t.isdigit()]
    return toks


def tfidf_index(docs: List[str]) -> Tuple[List[Dict[str, float]], Dict[str, float]]:
    # Return TF-IDF vectors and IDF dict
    tokenized = [tokenize(d) for d in docs]
    df: Counter = Counter()
    for toks in tokenized:
        df.update(set(toks))
    N = len(docs)
    idf: Dict[str, float] = {}
    for term, dfi in df.items():
        idf[term] = math.log((N + 1) / (dfi + 1)) + 1.0
    vectors: List[Dict[str, float]] = []
    for toks in tokenized:
        tf = Counter(toks)
        vec: Dict[str, float] = {t: (tf[t] / max(1, len(toks))) * idf.get(t, 0.0) for t in tf}
        # L2 normalize
        norm = math.sqrt(sum(v * v for v in vec.values())) or 1.0
        for k in list(vec.keys()):
            vec[k] /= norm
        vectors.append(vec)
    return vectors, idf


def cosine(v1: Dict[str, float], v2: Dict[str, float]) -> float:
    if len(v1) > len(v2):
        v1, v2 = v2, v1
    return sum(v * v2.get(k, 0.0) for k, v in v1.items())


def top_sentences(outcome: str, text: str, k: int = 2) -> List[str]:
    # Split into sentences and score by overlap with outcome tokens
    sents = re.split(r"(?<=[.!?])\s+|\n{2,}", text)
    outcome_terms = set(tokenize(outcome))
    scored = []
    for s in sents:
        if len(s.strip()) < 40:
            continue
        terms = set(tokenize(s))
        if not terms:
            continue
        overlap = len(outcome_terms & terms)
        alpha = alpha_ratio(s)
        score = overlap + 0.2 * alpha
        scored.append((score, s.strip()))
    scored.sort(reverse=True)
    return [s for _, s in scored[:k]]


def load_outcomes_for_subject(subject: str) -> List[Dict[str, str]]:
    files = list(ALBERTA_PARSED.glob("*.json"))
    outcomes: List[Dict[str, str]] = []
    aliases = {
        "english": ["english", "ela"],
        "math": ["math", "mathematics"],
        "biology": ["biology"],
        "chemistry": ["chemistry"],
        "physics": ["physics"],
        "social": ["social"],
    }
    want = aliases.get(subject, [subject])
    for f in files:
        name = f.stem  # e.g., biology, biology_30, social_30_1
        if subject == "social":
            if not name.startswith("social"):
                continue
            data = json.loads(f.read_text(encoding="utf-8"))
            if isinstance(data, list):
                for item in data:
                    outcomes.append({"code": item.get("code", name), "description": item.get("description", "")})
            elif isinstance(data, dict):
                # rare, but handle
                for arr_key in ("general_outcomes", "specific_outcomes"):
                    for item in data.get(arr_key, []):
                        outcomes.append({"code": item.get("code", name), "description": item.get("description", "")})
            continue
        # STEM/ELA style dict format with aliases
        if not any(name.startswith(prefix) for prefix in want):
            continue
        data = json.loads(f.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            # Common layout with explicit arrays
            had_explicit = False
            for arr_key in ("general_outcomes", "specific_outcomes"):
                if arr_key in data:
                    had_explicit = True
                    for item in data.get(arr_key, []):
                        desc = item.get("description") or item.get("title") or ""
                        outcomes.append({"code": item.get("code", name), "description": desc})
            if not had_explicit:
                # Fallback: any list-valued fields (e.g., math_20_1.json categories)
                for k, v in data.items():
                    if isinstance(v, list):
                        for item in v:
                            if isinstance(item, dict):
                                desc = item.get("description") or item.get("title") or ""
                                outcomes.append({"code": item.get("code", f"{name}:{k}"), "description": desc})
        else:
            # unknown format; skip
            pass
    return outcomes


def align_subject(subject: str, top_k: int = 5, min_chars: int = 300) -> Dict:
    # Load cleaned chunks for docs of this subject
    doc_stems = [p.name for p in EXTRACTED_ROOT.iterdir() if p.is_dir() and subject_from_doc_stem(p.name) == subject]
    all_chunks: List[Chunk] = []
    for stem in doc_stems:
        cleaned_path = CLEAN_ROOT / stem / "clean_chunks.jsonl"
        if not cleaned_path.exists():
            # fall back to raw chunks then clean inline
            chunks = load_chunks_for_doc(stem)
            chunks = clean_chunks(chunks, min_chars=min_chars)
        else:
            chunks = []
            for line in cleaned_path.read_text(encoding="utf-8").splitlines():
                j = json.loads(line)
                chunks.append(Chunk(doc=j["doc"], doc_stem=stem, heading=j.get("heading"), text=j["text"], pages=j.get("pages", []), char_count=len(j["text"])) )
        all_chunks.extend(chunks)

    if not all_chunks:
        return {"subject": subject, "outcomes": []}

    # Build TF-IDF index over chunk texts (doc corpus)
    corpus_texts = [c.text for c in all_chunks]
    vectors, idf = tfidf_index(corpus_texts)

    outcomes = load_outcomes_for_subject(subject)
    aligned = []
    for oc in outcomes:
        desc = oc.get("description", "")
        if not desc:
            continue
        # Vectorize outcome as one doc against same IDF space
        oc_tokens = tokenize(desc)
        oc_tf = Counter(oc_tokens)
        oc_vec = {t: (oc_tf[t] / max(1, len(oc_tokens))) * idf.get(t, 0.0) for t in oc_tf}
        norm = math.sqrt(sum(v * v for v in oc_vec.values())) or 1.0
        for k in list(oc_vec.keys()):
            oc_vec[k] /= norm
        # Score all chunks
        scores = [(cosine(oc_vec, v), i) for i, v in enumerate(vectors)]
        scores.sort(reverse=True)
        top = []
        for sc, idx in scores[:top_k]:
            c = all_chunks[idx]
            if sc <= 0:
                continue
            snips = top_sentences(desc, c.text, k=2)
            top.append({
                "score": round(float(sc), 4),
                "doc": c.doc,
                "doc_stem": c.doc_stem,
                "pages": c.pages,
                "heading": c.heading,
                "snippets": snips if snips else [c.text[:280] + ("…" if len(c.text) > 280 else "")],
            })
        if top:
            aligned.append({"code": oc.get("code"), "description": desc, "matches": top})

    return {"subject": subject, "outcomes": aligned}


def save_clean_outputs(doc_stem: str, chunks: List[Chunk]) -> None:
    out_dir = CLEAN_ROOT / doc_stem
    out_dir.mkdir(parents=True, exist_ok=True)
    # jsonl
    with (out_dir / "clean_chunks.jsonl").open("w", encoding="utf-8") as f:
        for c in chunks:
            f.write(json.dumps({
                "doc": c.doc,
                "heading": c.heading,
                "text": c.text,
                "pages": c.pages,
            }, ensure_ascii=False) + "\n")
    # markdown
    (out_dir / "doc_clean.md").write_text(chunks_to_markdown(doc_stem, chunks), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description="Clean PDF chunks and align to Alberta curriculum outcomes")
    parser.add_argument("--clean", action="store_true", help="Run cleaning on all extracted docs")
    parser.add_argument("--align", choices=["biology", "chemistry", "physics", "math", "english", "social"], help="Align a specific subject")
    parser.add_argument("--align-all", action="store_true", help="Align all supported subjects")
    parser.add_argument("--top-k", type=int, default=5)
    parser.add_argument("--min-chars", type=int, default=200)
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    if args.clean:
        stems = [p.name for p in EXTRACTED_ROOT.iterdir() if p.is_dir()]
        for i, stem in enumerate(sorted(stems), 1):
            if args.verbose:
                print(f"[{i}/{len(stems)}] Cleaning {stem}")
            chunks = load_chunks_for_doc(stem)
            cleaned = clean_chunks(chunks, min_chars=args.min_chars)
            save_clean_outputs(stem, cleaned)
        print(f"Cleaned {len(stems)} document(s). Outputs in {CLEAN_ROOT}")

    subjects = []
    if args.align:
        subjects = [args.align]
    elif args.align_all:
        subjects = ["biology", "chemistry", "physics", "math", "english", "social"]

    ALIGN_ROOT.mkdir(parents=True, exist_ok=True)
    for sub in subjects:
        if args.verbose:
            print(f"Aligning subject: {sub}")
        res = align_subject(sub, top_k=args.top_k, min_chars=args.min_chars)
        out_path = ALIGN_ROOT / f"{sub}.json"
        out_path.write_text(json.dumps(res, indent=2), encoding="utf-8")
        if args.verbose:
            print(f"  Wrote {out_path}")


if __name__ == "__main__":
    main()
