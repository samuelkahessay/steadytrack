#!/bin/bash
# Resume LLM population from where we left off
# Processes remaining subjects that haven't had LLM ranking yet

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/.."

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║   🔄 Resuming LLM Resource Population (GPT-5-mini)            ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "📊 Status Check:"
echo "   ✅ Biology 20: Already processed with LLM (66% coverage)"
echo "   ⏳ Biology 30: Needs LLM (93 outcomes)"
echo "   ⏳ Chemistry 20: Needs LLM (71 outcomes)"
echo "   ⏳ Chemistry 30: Needs LLM (75 outcomes)"
echo "   ⏳ Physics 20: Needs LLM (69 outcomes)"
echo "   ⏳ Physics 30: Needs LLM (102 outcomes)"
echo ""
echo "📈 Remaining: 410 outcomes to process"
echo "⏱️  Estimated time: 20-30 minutes"
echo "💰 Estimated cost: ~$0.40-0.80"
echo ""

# Create logs directory
mkdir -p data/logs

# Generate log filename with timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOGFILE="data/logs/llm_resume_${TIMESTAMP}.log"

echo "📝 Logging to: $LOGFILE"
echo ""
echo "Starting in 3 seconds... (Ctrl+C to cancel)"
sleep 3

echo ""
echo "🚀 Resuming LLM-assisted resource population..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Process each subject that needs LLM ranking
SUBJECTS=("bio-30" "chem-20" "chem-30" "phys-20" "phys-30")

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
echo "✅ All subjects processed with LLM!"
echo ""
echo "📂 Output saved to:"
echo "   Log: $LOGFILE"
echo ""
echo "📊 Next step: Validate coverage"
echo "   Run: npx tsx scripts/validate-coverage.ts"
echo ""
echo "🎉 Done! You should see significant coverage improvements."
echo ""
