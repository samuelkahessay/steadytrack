#!/bin/bash
# Friendly LLM-assisted resource population script
# Runs GPT-5-mini to intelligently match resources to curriculum outcomes

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/.."

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║   🤖 SteadyTrack LLM Resource Population (GPT-5-mini)         ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "This will use OpenAI's GPT-5-mini to intelligently rank and match"
echo "educational resources to Alberta curriculum outcomes."
echo ""
echo "📊 Current Status: 60% coverage (491/823 outcomes)"
echo "🎯 Target: 70-80% coverage with AI assistance"
echo ""
echo "⏱️  Estimated time: 15-30 minutes for all 6 science subjects"
echo "💰 Estimated cost: ~$0.50-1.00 (GPT-5-mini is very cheap!)"
echo ""

# Create logs directory
mkdir -p data/logs

# Generate log filename with timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOGFILE="data/logs/llm_population_${TIMESTAMP}.log"

echo "📝 All output will be logged to: $LOGFILE"
echo ""
echo "Starting in 3 seconds... (Ctrl+C to cancel)"
sleep 3

echo ""
echo "🚀 Starting LLM-assisted resource population..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Run the Python script with friendly output (unbuffered for real-time display)
scripts/.venv/bin/python -u scripts/resource-populator-enhanced.py \
    --all-sciences \
    --use-llm \
    --llm-model gpt-5-mini \
    --write \
    2>&1 | tee "$LOGFILE"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ LLM population complete!"
echo ""
echo "📂 Output saved to:"
echo "   Log: $LOGFILE"
echo ""
echo "📊 Next step: Validate coverage"
echo "   Run: npx tsx scripts/validate-coverage.ts"
echo ""
echo "🎉 Done! Check the log file for detailed results."
echo ""
