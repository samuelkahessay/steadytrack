#!/bin/bash
# Process the ACTUAL remaining 327 gaps with GPT-5-mini
# Uses fresh gap data from detect-resource-gaps.ts

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/.."

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║   🎯 Final LLM Gap Filling (GPT-5-mini)                       ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "📊 Current Status: 60% coverage (496/823 outcomes)"
echo "🎯 Target: 70-75% coverage"
echo ""
echo "📋 Remaining Gaps (327 total):"
echo "   • Physics 30:    69 gaps"
echo "   • Biology 30:    61 gaps"
echo "   • Chemistry 20:  47 gaps"
echo "   • Physics 20:    46 gaps"
echo "   • Chemistry 30:  44 gaps"
echo "   • Biology 20:    40 gaps"
echo "   • ELA 30-1:      12 gaps"
echo "   • ELA 20-1:       8 gaps"
echo ""
echo "⏱️  Estimated time: 15-20 minutes"
echo "💰 Estimated cost: ~$0.30-0.60"
echo ""

# Create logs directory
mkdir -p data/logs

# Generate log filename with timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOGFILE="data/logs/llm_final_${TIMESTAMP}.log"

echo "📝 Logging to: $LOGFILE"
echo ""
echo "Starting in 3 seconds... (Ctrl+C to cancel)"
sleep 3

echo ""
echo "🚀 Processing final gaps with GPT-5-mini..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Process all subjects with remaining gaps
SUBJECTS=("phys-30" "bio-30" "chem-20" "phys-20" "chem-30" "bio-20")

for SUBJECT in "${SUBJECTS[@]}"; do
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "  Processing: $SUBJECT"
    echo "═══════════════════════════════════════════════════════════════"
    echo ""

    scripts/.venv/bin/python -u scripts/resource-populator-enhanced.py \
        --subject "$SUBJECT" \
        --use-llm \
        --llm-model gpt-5-mini \
        --write \
        2>&1 | tee -a "$LOGFILE"

    echo ""
    echo "✅ Completed: $SUBJECT"
    echo ""
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ All science gaps processed with LLM!"
echo ""
echo "📂 Output saved to:"
echo "   Log: $LOGFILE"
echo ""
echo "📊 Validating final coverage..."
echo ""

# Run validation
npx tsx scripts/validate-coverage.ts

echo ""
echo "🎉 Done! Check the summary above for final coverage."
echo ""
