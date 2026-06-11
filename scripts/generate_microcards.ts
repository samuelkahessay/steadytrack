/*
  Generate outcome-level microcards with an LLM (copyright-safe paraphrasing) or fallback heuristics.

  Usage examples:
    - tsx scripts/generate_microcards.ts --subject "Math 30-1" --limit 10 --persist file
    - tsx scripts/generate_microcards.ts --subject "Biology 30" --persist db
    - tsx scripts/generate_microcards.ts --file data/curriculum/math-30-1.json --persist file

  Env vars:
    - OPENAI_API_KEY           (optional; if missing, uses heuristic fallback)
    - OPENAI_MODEL             (optional; default: gpt-4o-mini)
    - SUPABASE_URL             (required for --persist db)
    - SUPABASE_SERVICE_ROLE_KEY(required for --persist db)
*/

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

type CurriculumUnit = {
  id: string;
  title: string;
  topics?: string[];
  estimatedHours?: number;
  outcomes?: Array<{ code: string; description?: string; title?: string }>;
  resources?: Array<{ title: string; url: string; type: string; difficulty?: string }>;
};

type CurriculumSubject = {
  subject: string;
  grade: number;
  albertaDocs?: Array<{ title: string; url: string; type?: string }>;
  units: CurriculumUnit[];
};

type Microcard = {
  subject: string;
  unit_id: string;
  outcome_code: string;
  summary: string;
  steps: string[];
  pitfall?: string;
  quick_check: { question: string; choices: string[]; answer: string; explanation: string };
  recommended_resource_url?: string;
  sources: Array<{ type: string; title: string; url?: string; doc_stem?: string; pages?: number[] }>;
  version?: number;
  status?: 'active' | 'draft' | 'archived';
};

const arg = (flag: string): string | undefined => {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
};

const subjectArg = arg('--subject');
const fileArg = arg('--file');
const limitArg = arg('--limit');
const persistArg = arg('--persist'); // 'file' | 'db'
const useBooksArg = arg('--use-books'); // 'true' | 'false'
const verbatimArg = arg('--verbatim-hints'); // 'true' | 'false'
const verboseArg = arg('--verbose'); // 'true' | 'false'
const resumeArg = arg('--resume'); // 'true' | 'false'
const flushEveryArg = arg('--flush-every'); // number

const LIMIT = limitArg ? Math.max(1, Number(limitArg)) : undefined;
const PERSIST_MODE = (persistArg as 'file' | 'db' | undefined) ?? 'file';
const USE_BOOKS = useBooksArg ? useBooksArg === 'true' : true;
const USE_VERBATIM_HINTS = verbatimArg ? verbatimArg === 'true' : true;
const VERBOSE = verboseArg ? verboseArg === 'true' : false;
const RESUME = resumeArg ? resumeArg === 'true' : true;
const FLUSH_EVERY = flushEveryArg ? Math.max(1, Number(flushEveryArg)) : 25;

const ROOT = process.cwd();
const CURR_DIR = path.join(ROOT, 'data', 'curriculum');
const DERIVED_DIR = path.join(ROOT, 'data', 'derived');
const ALIGN_MERGED_DIR = path.join(ROOT, 'data', 'alignment_llm_merged');
const CLEAN_DIR = path.join(ROOT, 'data', 'clean');
const GAP_CACHE = path.join(ROOT, 'data', 'cache', 'llm_gap_filler_cache_async.json');

// Lightweight .env loader (supports .env.local and .env) without extra deps
function loadEnvFiles(files: string[]) {
  for (const f of files) {
    try {
      if (!fs.existsSync(f)) continue;
      const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
      for (const raw of lines) {
        const line = raw.trim();
        if (!line || line.startsWith('#')) continue;
        // support optional 'export KEY=VALUE'
        const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (!m) continue;
        const key = m[1];
        let val = m[2];
        // Remove surrounding quotes if present
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (process.env[key] === undefined) {
          process.env[key] = val;
        }
      }
    } catch {}
  }
}

loadEnvFiles([path.join(ROOT, '.env.local'), path.join(ROOT, '.env')]);

function readJSON<T>(p: string): T {
  const raw = fs.readFileSync(p, 'utf8');
  return JSON.parse(raw) as T;
}

function alignQuickCheckAnswer(qc: Microcard['quick_check']): Microcard['quick_check'] {
  if (!qc || !Array.isArray(qc.choices) || qc.choices.length === 0) return qc;
  const rawAnswer = typeof qc.answer === 'string' ? qc.answer.trim() : '';
  if (!rawAnswer) return qc;
  if (qc.choices.includes(rawAnswer)) return qc;

  if (rawAnswer.length === 1) {
    const letter = rawAnswer.toUpperCase();
    const match = qc.choices.find((choice) => {
      const trimmed = choice.trim();
      return (
        trimmed.startsWith(`${letter})`) ||
        trimmed.startsWith(`${letter}:`) ||
        trimmed.startsWith(`${letter}.`) ||
        trimmed.startsWith(`${letter} `)
      );
    });
    if (match) {
      return { ...qc, answer: match };
    }
  }

  console.warn(
    `[warn] quick_check answer mismatch: '${rawAnswer}' not found in choices [${qc.choices.join(
      ' | '
    )}]`
  );
  return qc;
}

function normalizeSubjectName(s: string): string {
  return s
    .toLowerCase()
    .replace(/mathematics/g, 'math')
    .replace(/english language arts/g, 'english')
    .replace(/language arts/g, 'english')
    .replace(/social studies/g, 'social')
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function findSubjectFileByName(name: string): string | null {
  const files = fs.readdirSync(CURR_DIR).filter((f) => f.endsWith('.json'));
  const targetNorm = normalizeSubjectName(name);
  for (const f of files) {
    const full = path.join(CURR_DIR, f);
    try {
      const data = readJSON<CurriculumSubject>(full);
      const subj = data.subject || '';
      if (subj === name) return full;
      const subjNorm = normalizeSubjectName(subj);
      if (subjNorm === targetNorm) return full;
    } catch {}
  }
  return null;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
}

function subjectGroupSlug(subject: string): string | null {
  const s = subject.toLowerCase();
  if (s.includes('math')) return 'math';
  if (s.includes('physics')) return 'physics';
  if (s.includes('chem')) return 'chemistry';
  if (s.includes('bio')) return 'biology';
  if (s.includes('english')) return 'english';
  if (s.includes('social')) return 'social';
  return null;
}

const STOPWORDS = new Set<string>([
  'the','a','an','and','or','but','of','to','in','on','for','by','with','as','is','are','was','were','be','been','it','that','this','these','those','from','at','we','you','they','i','he','she','them','his','her','their','our','your','its','not','can','may','might','must','should','could','would','if','then','than','so','such','into','over','under','out','about','up','down','left','right','more','most','less','least','also','there','here','when','where','why','how'
]);

function extractKeywords(text: string, max = 20): string[] {
  const tokens = (text.toLowerCase().match(/[a-z][a-z0-9\-]+/g) || []).filter((w) => w.length > 2 && !STOPWORDS.has(w));
  const freq = new Map<string, number>();
  for (const t of tokens) freq.set(t, (freq.get(t) || 0) + 1);
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([w]) => w);
}

function extractUnits(text: string): string[] {
  const units = new Set<string>();
  const patterns = [/m\/?s\^?2?/g, /n\b/g, /j\b/g, /kg\b/g, /s\b/g, /m\b/g];
  for (const p of patterns) {
    const m = text.toLowerCase().match(p);
    if (m) m.forEach((u) => units.add(u));
  }
  return Array.from(units).slice(0, 8);
}

function extractVariables(text: string): string[] {
  // Collect common physics/math variable-like tokens (v, a, f, g, p, q, r, x, y)
  const vars = new Set<string>();
  const m = text.match(/\b([vafgpmqrxytk])\b/gi);
  if (m) m.forEach((v) => vars.add(v.toLowerCase()));
  return Array.from(vars).slice(0, 10);
}

type BookHints = { terms: string[]; variables: string[]; units: string[]; provenance: Array<{ doc_stem: string; pages: number[] }>; excerpts?: string };

function gatherBookHints(subjectGroup: string | null, outcomeCode: string): BookHints | null {
  if (!subjectGroup) return null;
  const f = path.join(ALIGN_MERGED_DIR, `${subjectGroup}.json`);
  if (!fs.existsSync(f)) return null;
  try {
    const obj = readJSON<any>(f);
    const outcome = (obj?.outcomes || []).find((o: any) => o.code === outcomeCode);
    if (!outcome || !Array.isArray(outcome.evidence)) return null;
    const provenance: Array<{ doc_stem: string; pages: number[] }> = [];
    const texts: string[] = [];
    for (const ev of outcome.evidence) {
      const stem = ev.doc_stem as string;
      const pages = Array.isArray(ev.pages) ? ev.pages : [];
      if (!stem) continue;
      const cleanPath = path.join(CLEAN_DIR, stem, 'clean_chunks.jsonl');
      if (!fs.existsSync(cleanPath)) continue;
      const lines = fs.readFileSync(cleanPath, 'utf8').split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const chunk = JSON.parse(line);
          const chunkPages: number[] = chunk.pages || [];
          const overlap = pages.length ? chunkPages.some((p: number) => pages.includes(p)) : true;
          if (overlap && chunk.text) {
            texts.push(String(chunk.text));
          }
        } catch {}
      }
      if (pages.length) provenance.push({ doc_stem: stem, pages });
    }
    const merged = texts.slice(0, 20).join(' '); // for keyword extraction
    // Build limited verbatim excerpts for LLM calibration only
    let excerpts: string | undefined;
    if (USE_VERBATIM_HINTS) {
      const parts = texts.slice(0, 10).map((t, i) => `Excerpt ${i + 1}:\n` + String(t));
      const joined = parts.join('\n\n');
      const MAX_EXCERPT_CHARS = 1800;
      excerpts = joined.slice(0, MAX_EXCERPT_CHARS);
    }
    return {
      terms: extractKeywords(merged, 20),
      variables: extractVariables(merged),
      units: extractUnits(merged),
      provenance,
      ...(excerpts ? { excerpts } : {}),
    };
  } catch {
    return null;
  }
}

function pickRecommendedFromGapCache(curriculumFileBase: string | null, outcomeCode: string, unit: CurriculumUnit): string | undefined {
  try {
    if (!curriculumFileBase) return unit.resources?.[0]?.url;
    if (!fs.existsSync(GAP_CACHE)) return unit.resources?.[0]?.url;
    const cache = readJSON<Record<string, any>>(GAP_CACHE);
    const key = `${curriculumFileBase}:${outcomeCode}`;
    const item = cache[key];
    if (!item || !Array.isArray(item.candidates) || item.candidates.length === 0) return unit.resources?.[0]?.url;
    // Prefer embeddable public sources
    const preferred = item.candidates.find((c: any) => c.provider && /(openstax|phet|khan)/i.test(c.provider)) || item.candidates[0];
    return preferred?.url || unit.resources?.[0]?.url;
  } catch {
    return unit.resources?.[0]?.url;
  }
}

function buildContext(unit: CurriculumUnit, subject: string) {
  // Non-copyrightable factual context: topics, resource titles/types, and official doc titles
  const topics = unit.topics?.slice(0, 6) ?? [];
  const resourceHints = (unit.resources ?? [])
    .slice(0, 5)
    .map((r) => `${r.type}: ${r.title}`);
  return {
    subject,
    unitTitle: unit.title,
    topics,
    resourceHints,
  };
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

async function callOpenAIJSON(
  messages: Array<{ role: 'system' | 'user'; content: string }>,
  opts?: { timeoutMs?: number; maxRetries?: number; verbose?: boolean }
): Promise<any | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const timeoutMs = opts?.timeoutMs ?? 90000; // 90s default
  const maxRetries = Math.max(0, opts?.maxRetries ?? 3);
  const verbose = !!opts?.verbose;

  let attempt = 0;
  while (attempt <= maxRetries) {
    attempt += 1;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.4,
          response_format: { type: 'json_object' },
          messages,
        }),
        signal: controller.signal,
      });
      clearTimeout(t);
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        if (verbose) console.error(`[openai] HTTP ${res.status} ${res.statusText} attempt ${attempt}/${maxRetries + 1}: ${txt.slice(0, 300)}...`);
        // Backoff on 429/5xx
        if ((res.status === 429 || res.status >= 500) && attempt <= maxRetries) {
          const delay = 2000 * attempt + Math.floor(Math.random() * 500);
          await sleep(delay);
          continue;
        }
        return null;
      }
      const json = await res.json();
      const content = json?.choices?.[0]?.message?.content;
      if (!content) return null;
      try {
        return JSON.parse(content);
      } catch (e) {
        if (verbose) console.error('[openai] JSON parse error, returning null');
        return null;
      }
    } catch (err: any) {
      clearTimeout(t);
      if (verbose) console.error(`[openai] request error attempt ${attempt}/${maxRetries + 1}: ${err?.message || err}`);
      if (attempt <= maxRetries) {
        const delay = 2000 * attempt + Math.floor(Math.random() * 500);
        await sleep(delay);
        continue;
      }
      return null;
    }
  }
  return null;
}

function fallbackMicrocard(subject: string, unit: CurriculumUnit, outcome: { code: string; description?: string }): Microcard {
  const base = (outcome.description || unit.title || '').replace(/\s+/g, ' ').trim();
  const short = base.length > 160 ? base.slice(0, 157) + '…' : base || `Key concept for ${outcome.code}`;
  const rec = unit.resources?.[0]?.url;
  const quickCheck = alignQuickCheckAnswer({
    question: `Which statement best matches outcome ${outcome.code}?`,
    choices: ['Definition focus', 'Computation focus', 'Graph-only focus', 'Irrelevant'],
    answer: 'Definition focus',
    explanation: 'Start with the concept definition; compute and graph after clarity.',
  });
  return {
    subject,
    unit_id: unit.id,
    outcome_code: outcome.code,
    summary: `Understand: ${short}. Apply the idea to a simple example before moving to variations.`,
    steps: [
      'Recall the definition or law in your own words',
      'Work a simple numeric example step by step',
      'Check units/assumptions and interpret the result',
    ],
    pitfall: 'Skipping units or sign conventions leads to wrong answers.',
    quick_check: quickCheck,
    ...(rec ? { recommended_resource_url: rec } : {}),
    sources: [],
    version: 1,
    status: 'draft',
  };
}

async function generateMicrocardLLM(subject: string, unit: CurriculumUnit, outcome: { code: string; description?: string }, curriculumFileBase: string | null): Promise<Microcard> {
  const context = buildContext(unit, subject);
  const sGroup = subjectGroupSlug(subject);
  const bookHints = USE_BOOKS ? gatherBookHints(sGroup, outcome.code) : null;
  const sys = `You are generating short learning microcards for high-school students aligned to Alberta outcomes.
Safety & Copyright:
- Do NOT quote or reproduce any proprietary book text.
- Paraphrase in your own words.
- Never output more than 8 consecutive words that could match a source.
- Keep it brief, helpful, and neutral.

Output strictly as JSON with keys: subject, unit_id, outcome_code, summary, steps, pitfall, quick_check{question,choices,answer,explanation}, recommended_resource_url, sources[{type,title,url}], version, status.`;

  const user = `Subject: ${subject}
Unit: ${unit.title}
Outcome: ${outcome.code}${outcome.description ? ` — ${outcome.description}` : ''}

Context (non-copyrightable hints):
- Topics: ${context.topics.join('; ')}
- Resource prompts: ${context.resourceHints.join('; ')}
${bookHints ? `- Book-derived terms (keywords only): ${bookHints.terms.join(', ')}
- Symbols/variables: ${bookHints.variables.join(', ')}
- Units: ${bookHints.units.join(', ')}
- Provenance (for internal guidance only): ${bookHints.provenance.map(p => `${p.doc_stem} p.${p.pages.slice(0,3).join(',')}${p.pages.length>3?'…':''}`).join(' | ')}` : ''}
${bookHints?.excerpts ? `\nReference excerpts (verbatim; DO NOT QUOTE OR COPY; calibration only):\n-----\n${bookHints.excerpts}\n-----` : ''}

Constraints:
- summary: <= 80 words, plain language.
- steps: 3–5 short bullets.
- pitfall: <= 30 words.
- quick_check: 1 multiple-choice question with 4 concise choices, 1 correct answer, and <= 60-word explanation (no trick questions).
- recommended_resource_url: pick a single public resource (OpenStax, Khan, PhET) if helpful; otherwise null.
- sources: up to 3 public references only (no proprietary).
 - STRICT: You must NOT reproduce phrasing from the excerpts. Rephrase everything. Avoid more than 8 identical consecutive words from any source.

Produce JSON only.`;

  const parsed = await callOpenAIJSON([
    { role: 'system', content: sys },
    { role: 'user', content: user },
  ], { timeoutMs: 90000, maxRetries: 3, verbose: VERBOSE });

  if (!parsed) return fallbackMicrocard(subject, unit, outcome);

  // Light validation + fill required fields
  const rec = parsed.recommended_resource_url || pickRecommendedFromGapCache(curriculumFileBase, outcome.code, unit);
  const mc: Microcard = {
    subject: parsed.subject || subject,
    unit_id: parsed.unit_id || unit.id,
    outcome_code: parsed.outcome_code || outcome.code,
    summary: parsed.summary || 'Brief concept summary.',
    steps: Array.isArray(parsed.steps) && parsed.steps.length > 0 ? parsed.steps.slice(0, 5) : ['Understand concept', 'Apply example', 'Check units'],
    pitfall: parsed.pitfall || 'Avoid common misinterpretations.',
    quick_check: parsed.quick_check || {
      question: `Which statement best matches outcome ${outcome.code}?`,
      choices: ['A', 'B', 'C', 'D'],
      answer: 'A',
      explanation: 'Because it directly reflects the core idea.',
    },
    ...(rec ? { recommended_resource_url: rec } : {}),
    sources: Array.isArray(parsed.sources) ? parsed.sources.slice(0, 3) : [],
    version: 1,
    status: 'active',
  };
  mc.quick_check = alignQuickCheckAnswer(mc.quick_check);
  return mc;
}

async function persistToFile(subject: string, microcards: Microcard[]) {
  if (!fs.existsSync(DERIVED_DIR)) fs.mkdirSync(DERIVED_DIR, { recursive: true });
  const outPath = path.join(DERIVED_DIR, `${slugify(subject)}-microcards.jsonl`);
  const lines = microcards.map((m) => JSON.stringify(m));
  fs.writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
  console.log(`Wrote ${microcards.length} microcards → ${outPath}`);
}

async function persistToDB(subject: string, microcards: Microcard[]) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for DB persist');
  const sb = createClient(url, key);

  // Upsert into content_microcards (subject, outcome_code) unique
  const payload = microcards.map((m) => ({
    subject: m.subject,
    unit_id: m.unit_id,
    outcome_code: m.outcome_code,
    summary: m.summary,
    steps: m.steps,
    pitfall: m.pitfall ?? null,
    quick_check: m.quick_check,
    recommended_resource_url: m.recommended_resource_url ?? null,
    sources: m.sources ?? [],
    version: m.version ?? 1,
    status: m.status ?? 'active',
  }));

  const { error } = await sb
    .from('content_microcards')
    .upsert(payload, { onConflict: 'subject,outcome_code' });
  if (error) throw error;
  console.log(`Upserted ${payload.length} microcards into content_microcards`);
}

async function listExistingOutcomeCodes(subject: string): Promise<Set<string>> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return new Set();
  const sb = createClient(url, key);
  const out = new Set<string>();
  try {
    let page = 0;
    const size = 1000;
    while (true) {
      const { data, error } = await sb
        .from('content_microcards')
        .select('outcome_code')
        .eq('subject', subject)
        .range(page * size, page * size + size - 1);
      if (error) break;
      if (!data || data.length === 0) break;
      for (const row of data) if (row?.outcome_code) out.add(row.outcome_code);
      if (data.length < size) break;
      page += 1;
    }
  } catch {}
  return out;
}

async function main() {
  try {
    if (!subjectArg && !fileArg) {
      console.error('Provide --subject "Name" or --file path to curriculum JSON');
      process.exit(1);
    }

    let filePath: string | null = fileArg ?? null;
    if (!filePath && subjectArg) {
      filePath = findSubjectFileByName(subjectArg);
      if (!filePath) {
        console.error(`Could not find curriculum file for subject: ${subjectArg}`);
        console.error('Hint: Available subjects are:');
        const files = fs.readdirSync(CURR_DIR).filter((f) => f.endsWith('.json'));
        for (const f of files) {
          try {
            const full = path.join(CURR_DIR, f);
            const d = readJSON<CurriculumSubject>(full);
            console.error(`- ${d.subject}`);
          } catch {}
        }
        process.exit(1);
      }
    }

    if (VERBOSE) console.log(`[info] Reading curriculum: ${filePath}`);
    const curriculum = readJSON<CurriculumSubject>(filePath!);
    const subject = curriculum.subject;
    const curriculumFileBase = filePath ? path.basename(filePath) : null;
    let buffer: Microcard[] = [];

    let outcomeTotal = 0;
    for (const unit of curriculum.units) outcomeTotal += (unit.outcomes?.length || 0);
    if (VERBOSE) console.log(`[info] Subject: ${subject} | Units: ${curriculum.units.length} | Outcomes: ${outcomeTotal}${LIMIT ? ` | Limit: ${LIMIT}` : ''}`);

    // Resume support: skip outcomes already in DB when persisting to DB
    const existing = (PERSIST_MODE === 'db' && RESUME) ? await listExistingOutcomeCodes(subject) : new Set<string>();
    if (VERBOSE && existing.size > 0) console.log(`[info] Resume mode: found ${existing.size} existing outcome microcards in DB; will skip.`);

    for (const unit of curriculum.units) {
      const outcomes = unit.outcomes ?? [];
      for (const outcome of outcomes) {
        if (!outcome.code) continue;
        if (existing.has(outcome.code)) {
          if (VERBOSE) console.log(`[skip] ${subject} | ${unit.id} | ${outcome.code} (already in DB)`);
          continue;
        }
        if (VERBOSE) console.log(`[gen] ${subject} | ${unit.id} | ${outcome.code} ...`);
        const mc = await generateMicrocardLLM(subject, unit, outcome, curriculumFileBase);
        buffer.push(mc);
        if (VERBOSE) console.log(`[ok ] ${subject} | ${unit.id} | ${outcome.code}`);
        if (PERSIST_MODE === 'db' && buffer.length >= FLUSH_EVERY) {
          if (VERBOSE) console.log(`[db ] Flushing ${buffer.length} microcards...`);
          await persistToDB(subject, buffer);
          buffer = [];
        }
        if (LIMIT && (existing.size + buffer.length) >= LIMIT) break;
      }
      if (LIMIT && (existing.size + buffer.length) >= LIMIT) break;
    }

    if (buffer.length === 0 && existing.size === 0) {
      console.warn('No outcomes found to generate microcards.');
      process.exit(0);
    }

    if (PERSIST_MODE === 'db') {
      if (buffer.length > 0) {
        if (VERBOSE) console.log(`[db ] Final flush ${buffer.length} microcards...`);
        await persistToDB(subject, buffer);
        buffer = [];
      }
    } else {
      if (VERBOSE) console.log(`[file] Writing microcards to file...`);
      // For file mode, we didn’t write incrementally — buffer holds all
      await persistToFile(subject, buffer);
    }
    if (VERBOSE) console.log('[done] Generation complete.');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

void main();
