# Content Microcards (Derived, Copyright-Safe)

Purpose: store brief, helpful concept cards per curriculum outcome with a 1-question quick check, fully paraphrased.

## DB Tables

- `content_microcards` (public read-only)
  - Keys: `subject`, `unit_id`, `outcome_code`, `summary`, `steps[]`, `pitfall`, `quick_check{question,choices,answer,explanation}`, `recommended_resource_url`, `sources[]`, `status`, `version`
  - Readable by anon/authenticated. Mutations restricted to `service_role`.

- `quick_check_results` (per-user)
  - Records whether a user answered correctly for an outcome/microcard.
  - Standard own-row RLS.

See migration: `migrations/003_add_content_microcards.sql:1`.

## Generation Script

`scripts/generate_microcards.ts`

Examples:

```bash
# File output (JSONL under data/derived/)
tsx scripts/generate_microcards.ts --subject "Math 30-1" --limit 10 --persist file

# Upsert to DB (requires service role key)
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
  OPENAI_API_KEY=... \
  tsx scripts/generate_microcards.ts --subject "Biology 30" --persist db
```

Env vars:

- `OPENAI_API_KEY` (optional; if missing, script falls back to heuristics)
- `OPENAI_MODEL` (optional; default `gpt-4o-mini`)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (required for `--persist db`)

Optional flags:

- `--use-books true|false` (default `true`) — uses structured book outputs as non‑copyrightable hints (keywords, variables, units, provenance pages) to guide the LLM, without quoting or reproducing text.
- `--verbatim-hints true|false` (default `true`) — includes limited verbatim excerpts from book clean chunks in the prompt for calibration of scope/difficulty; the model is explicitly instructed to paraphrase and avoid reproducing this text. No verbatim book text is stored or displayed to users.

## Copyright Safety

- The prompt enforces paraphrasing and forbids quoting proprietary texts.
- Only non-copyrightable context is provided: topics, public resource titles, and book‑derived keywords/variables/units.
- Sources list includes public references only (OpenStax, Khan, PhET, etc.).
- Book alignment data guides topic selection internally; no verbatim text is stored or displayed.

## How Structured Book Data Is Used

- Alignment evidence (`data/alignment_llm_merged/*.json`) points to `doc_stem` and page ranges.
- Clean chunks (`data/clean/<doc_stem>/clean_chunks.jsonl`) are scanned to extract:
  - frequent keywords (non‑expressive terms)
  - common variable symbols
  - units (e.g., m/s², N, J)
- These hints are included in the LLM prompt to improve accuracy while avoiding direct text reproduction.
- When `--verbatim-hints` is enabled, a short, capped excerpt (e.g., ~1800 chars total) is passed to the model as “reference excerpts (do not quote)”. This is user‑provided content used solely for internal guidance. Output remains paraphrased and never includes verbatim book text.


## UI Consumption (next steps)

- Plan view (`components/plan/UnitCheckbox.tsx`) can fetch microcards by `(subject, outcome_code)` and render a collapsible “Need a hand?” microcard with the quick check.
- Dashboard Today’s Focus can use `quick_check_results` to suggest a remedial microcard before new content.
