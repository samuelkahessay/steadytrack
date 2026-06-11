#!/bin/bash
# LLM population with intelligent caching - saves your money!

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/.."

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║   💾 LLM Resource Population WITH CACHING                     ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "✨ Smart Caching Features:"
echo "   • Saves LLM rankings to avoid re-processing"
echo "   • Only makes API calls for NEW outcomes"
echo "   • Saves intermediate results for inspection"
echo "   • Can resume from where you left off"
echo ""
echo "📂 Cache location: data/cache/"
echo "💰 This will save you money on re-runs!"
echo ""

# Create logs directory
mkdir -p data/logs

# Generate log filename with timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOGFILE="data/logs/llm_cached_${TIMESTAMP}.log"

echo "📝 Logging to: $LOGFILE"
echo ""
echo "Starting in 3 seconds... (Ctrl+C to cancel)"
sleep 3

echo ""
echo "🚀 Processing with smart caching..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Process all subjects with caching
scripts/.venv/bin/python -u scripts/resource-populator-with-cache.py \
    --all-sciences \
    --use-llm \
    --llm-model gpt-5-mini \
    --write \
    2>&1 | tee "$LOGFILE"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Complete!"
echo ""
echo "📂 Files saved:"
echo "   Log: $LOGFILE"
echo "   Cache: data/cache/*_cache.json"
echo ""
echo "💡 Next time you run this, it will use cached LLM results!"
echo ""
echo "📊 Validate coverage:"
echo "   npx tsx scripts/validate-coverage.ts"
echo ""
