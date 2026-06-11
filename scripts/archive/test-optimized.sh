#!/bin/bash
# Quick test of optimized populator (5 outcomes)

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/.."

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║   ⚡ OPTIMIZED Population Test (5 outcomes)                   ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "✨ Optimizations:"
echo "   • Batch LLM: 5 outcomes per API call (3-4x faster)"
echo "   • Parallel searches: Khan + OpenStax + PhET concurrent (3x faster)"
echo "   • Smart caching: Even when LLM skipped for 1-2 candidates"
echo "   • Concurrent processing: 10 outcomes at once"
echo ""
echo "🎯 Testing with 5 outcomes from Physics 30..."
echo ""

scripts/.venv/bin/python -u scripts/resource-populator-optimized.py \
    --subject phys-30 \
    --use-llm \
    --llm-model gpt-5-mini \
    --limit 5 \
    --write

echo ""
echo "✅ Test complete!"
echo ""
echo "💡 If this looks good, run the full version:"
echo "   ./scripts/run-optimized.sh"
echo ""
