#!/bin/bash
# Quick test with just 5 outcomes to verify LLM is working

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/.."

echo "🧪 Quick LLM Test (5 outcomes from Biology 30)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Run with unbuffered output for immediate feedback
scripts/.venv/bin/python -u scripts/resource-populator-enhanced.py \
    --subject bio-30 \
    --limit 5 \
    --use-llm \
    --llm-model gpt-5-mini \
    --dry-run

echo ""
echo "✅ Test complete! If you saw LLM ranking messages, it's working."
echo "   Now run: ./scripts/run-llm-population.sh for the full run"
