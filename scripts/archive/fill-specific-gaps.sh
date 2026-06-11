#!/bin/bash
# Fill the 22 specific hard-to-fill outcomes using LLM resource generation

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/.."

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║   🎯 LLM Resource Finder for Specific Outcomes                ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "🎯 Targeting: 22 specific hard-to-fill outcomes"
echo ""
echo "📋 Target Outcomes:"
echo ""
echo "   Biology 30 (4 outcomes):"
echo "     • 30-C2.2k: Punnett squares & inheritance patterns"
echo "     • 30-C1.5k: Crossing over & nondisjunction"
echo "     • 30-D1.3k: Hardy-Weinberg principle"
echo "     • 30-D2.2k: Defense mechanisms in predation"
echo ""
echo "   Biology 20 (3 outcomes):"
echo "     • 20-B1.5k: Taxonomy & binomial nomenclature"
echo "     • 20-D3.1k: Excretory system structures"
echo "     • 20-D3.3k: Kidney function"
echo ""
echo "   Chemistry 30 (2 outcomes):"
echo "     • 30-B1.5k: Oxidizing vs reducing agents"
echo "     • 30-B2.2sts: Corrosion prevention technologies"
echo ""
echo "   Chemistry 20 (3 outcomes):"
echo "     • 20-C1.1k: Pure substances vs mixtures"
echo "     • 20-C1.4k: Electrolytes vs nonelectrolytes"
echo "     • 20-D1.3k: Quantitative vs qualitative analysis"
echo ""
echo "   Physics 30 (6 outcomes):"
echo "     • 30-D3.2k: Nuclear equations - alpha/beta decay"
echo "     • 30-D3.3k: Half-life calculations"
echo "     • 30-D3.5k: Fission vs fusion"
echo "     • 30-C1.8k: Diffraction, interference, polarization"
echo "     • 30-C1.10k: Double-slit & diffraction grating"
echo "     • 30-C1.4k: Measuring speed of EMR"
echo ""
echo "   Physics 20 (4 outcomes):"
echo "     • 20-A1.2k: Scalar vs vector quantities"
echo "     • 20-B2.6k: Weight on different planets"
echo "     • 20-C2.5k: Power qualitative/quantitative"
echo ""
echo "🤖 LLM Strategy:"
echo "   • Ask GPT-4o-mini to recommend specific free resources"
echo "   • Sources: Khan Academy, MIT OCW, PhET, OpenStax, Wikipedia,"
echo "     LibreTexts, HyperPhysics, CK-12, YouTube edu channels, etc."
echo "   • Parse and validate suggestions"
echo "   • Add to curriculum with proper formatting"
echo ""
echo "⏱️  Estimated time: 3-5 minutes"
echo "💰 Estimated cost: ~\$0.10-0.20"
echo ""
echo "📊 Current Coverage: 92% (760/823)"
echo "🎯 Target: 94-95% coverage"
echo ""

# Create logs directory
mkdir -p data/logs

# Generate log filename with timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOGFILE="data/logs/llm_finder_${TIMESTAMP}.log"

echo "📝 Logging to: $LOGFILE"
echo ""
echo "Starting in 3 seconds... (Ctrl+C to cancel)"
sleep 3

echo ""
echo "🚀 Running LLM resource finder..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Run the finder
scripts/.venv/bin/python -u scripts/llm-resource-finder.py 2>&1 | tee "$LOGFILE"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Complete!"
echo ""
echo "📂 Files saved:"
echo "   Log: $LOGFILE"
echo "   Cache: data/cache/llm_finder_cache.json"
echo ""
echo "📊 Validating coverage..."
echo ""

# Run validation
npx tsx scripts/validate-coverage.ts

echo ""
echo "🎉 Done! Check coverage above."
echo ""
