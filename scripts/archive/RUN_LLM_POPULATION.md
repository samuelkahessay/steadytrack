# 🤖 Running LLM Resource Population

## Quick Start

```bash
cd ~/Desktop/steadytrack
./scripts/run-llm-population.sh
```

That's it! The script will:
- ✅ Run GPT-5-mini on all 6 science subjects (475 outcomes)
- ✅ Show friendly progress bars with percentages
- ✅ Log everything to `data/logs/llm_population_TIMESTAMP.log`
- ✅ Save results to curriculum JSON files

## What You'll See

```
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║   🤖 SteadyTrack LLM Resource Population (GPT-5-mini)         ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝

📊 Current Status: 60% coverage (491/823 outcomes)
🎯 Target: 70-80% coverage with AI assistance

⏱️  Estimated time: 15-30 minutes for all 6 science subjects
💰 Estimated cost: ~$0.50-1.00 (GPT-5-mini is very cheap!)

🚀 Starting LLM-assisted resource population...

📚 Biology 20 (Grade 11)
   Processing 65 outcomes
   Using LLM: ✓ Yes (gpt-5-mini)

   🔍 [1/65] [█░░░░░░░░░░░░░░░░░░░] 2% Searching for 20-A3.1k: Explain that the biosphere is composed of ecosystems...
      🤖 LLM ranking 5 candidates...
         ✓ LLM (gpt-5-mini) ranked top 4 resources
      ✓ Selected 4 resources (5 candidates evaluated)

   🔍 [2/65] [█░░░░░░░░░░░░░░░░░░░] 3% Searching for 20-A3.3k: Describe the process of ecological succession...
      🤖 LLM ranking 4 candidates...
         ✓ LLM (gpt-5-mini) ranked top 3 resources
      ✓ Selected 3 resources (4 candidates evaluated)

   ... (continues for all outcomes)

   💾 Saved data/curriculum/bio-20.json
   📊 Resources added: 245 total (avg 3.8 per outcome)

... (continues for all 6 subjects)

✅ LLM population complete!

📂 Output saved to:
   Log: data/logs/llm_population_20251008_143022.log

📊 Next step: Validate coverage
   Run: npx tsx scripts/validate-coverage.ts
```

## Progress Indicators

- `[X/Y]` - Current outcome / Total outcomes
- `[████████░░░░] 40%` - Visual progress bar
- `🤖 LLM ranking` - GPT-5-mini is analyzing resources
- `✓ LLM (gpt-5-mini) ranked` - AI successfully ranked resources
- `✓ Selected X resources (Y candidates)` - Final selection made

## Time Estimates

| Subject | Outcomes | Est. Time |
|---------|----------|-----------|
| Biology 20 | 65 | ~3-5 min |
| Biology 30 | 93 | ~4-7 min |
| Chemistry 20 | 71 | ~3-6 min |
| Chemistry 30 | 75 | ~4-6 min |
| Physics 20 | 69 | ~3-6 min |
| Physics 30 | 102 | ~5-8 min |
| **TOTAL** | **475** | **~15-30 min** |

## After It Finishes

1. **Check the log file** for any errors or warnings
2. **Validate coverage**:
   ```bash
   npx tsx scripts/validate-coverage.ts
   ```
3. **Expected result**: 70-80% coverage (up from 60%)

## Troubleshooting

### If it fails with API errors:
- Check `OPENAI_API_KEY` is set in `.env.local`
- Verify you have API credits

### If it's too slow:
- It's making 475+ API calls, patience is key!
- GPT-5-mini is fast but still takes ~2-4 seconds per outcome

### To review results after completion:
```bash
# View the log file
cat data/logs/llm_population_*.log | tail -100

# Check coverage
npx tsx scripts/validate-coverage.ts
```

## What GPT-5-mini Does

For each outcome, GPT-5-mini:
1. Reads the outcome description
2. Evaluates 3-8 candidate resources
3. Ranks them by:
   - Content alignment
   - Specificity to the outcome
   - Grade appropriateness
   - Learning value
   - Resource type suitability
4. Selects the top 3-4 best matches

This is MUCH smarter than keyword matching alone!

## Cost Estimate

- GPT-5-mini: $1.25/1M input tokens, $10/1M output tokens
- Estimated tokens per outcome: ~500 input, ~50 output
- Total: ~475 outcomes × 550 tokens = ~0.26M tokens
- **Estimated cost: $0.50-1.00 total**

Very affordable for the quality improvement!

---

**Ready to run?** Just execute: `./scripts/run-llm-population.sh`
