#!/usr/bin/env node
/**
 * Scans the repository for publicly facing Government of Alberta curriculum links
 * (PDFs and official Alberta Education pages) and generates an internal HTML report.
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const CURR_DIR = path.join(ROOT, 'data', 'curriculum');
const APP_DIR = path.join(ROOT, 'app');
const COMPONENTS_DIR = path.join(ROOT, 'components');
const OUT_DIR = path.join(ROOT, 'data', 'reports');
const OUT_FILE = path.join(OUT_DIR, 'alberta-curriculum-links.html');

const ALLOWED_HOST_PATTERNS = [
  /(^|\.)alberta\.ca$/i,
  /^education\.alberta\.ca$/i,
  /^open\.alberta\.ca$/i,
  /^learnalberta\.ca$/i,
];

function isAllowedHost(urlStr) {
  try {
    const u = new URL(urlStr);
    const host = u.hostname.toLowerCase();
    return ALLOWED_HOST_PATTERNS.some((re) => re.test(host));
  } catch {
    return false;
  }
}

function isPdf(urlStr) {
  return /\.pdf(\?|#|$)/i.test(urlStr);
}

function* walk(dir, filter = () => true) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      yield* walk(p, filter);
    } else if (e.isFile() && filter(p)) {
      yield p;
    }
  }
}

function collectUrlsFromText(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const urls = [];
  // Rough URL regex (avoid capturing quotes)
  const urlRe = /https?:\/\/[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]+/g;
  let m;
  while ((m = urlRe.exec(text)) !== null) {
    const raw = m[0].replace(/[)\]\"'`>,].*$/, '');
    if (isAllowedHost(raw)) {
      const line = text.slice(0, m.index).split(/\r?\n/).length;
      urls.push({ url: raw, line });
    }
  }
  return urls;
}

function collectUrlsFromJson(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let data;
  try {
    data = JSON.parse(content);
  } catch (e) {
    return [];
  }

  const urls = [];
  function visit(node) {
    if (!node) return;
    if (typeof node === 'string') return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) {
        if (k === 'url' && typeof v === 'string' && isAllowedHost(v)) {
          urls.push({ url: v });
        } else if (typeof v === 'object') {
          visit(v);
        }
      }
    }
  }
  visit(data);
  return urls;
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function dedupe(list, keyFn) {
  const map = new Map();
  for (const item of list) {
    const k = keyFn(item);
    if (!map.has(k)) map.set(k, item);
  }
  return Array.from(map.values());
}

function generateReport() {
  const findings = [];

  // Scan curriculum JSON (publicly rendered resources)
  for (const p of walk(CURR_DIR, (p) => p.endsWith('.json'))) {
    const rel = path.relative(ROOT, p);
    const urls = collectUrlsFromJson(p);
    for (const u of urls) {
      findings.push({ file: rel, line: null, url: u.url, type: isPdf(u.url) ? 'PDF' : 'Page' });
    }
  }

  // Scan app + components code for hardcoded Alberta links
  for (const p of walk(APP_DIR, (p) => /\.(t|j)sx?$/.test(p))) {
    const rel = path.relative(ROOT, p);
    const urls = collectUrlsFromText(p);
    for (const u of urls) {
      findings.push({ file: rel, line: u.line, url: u.url, type: isPdf(u.url) ? 'PDF' : 'Page' });
    }
  }
  for (const p of walk(COMPONENTS_DIR, (p) => /\.(t|j)sx?$/.test(p))) {
    const rel = path.relative(ROOT, p);
    const urls = collectUrlsFromText(p);
    for (const u of urls) {
      findings.push({ file: rel, line: u.line, url: u.url, type: isPdf(u.url) ? 'PDF' : 'Page' });
    }
  }

  // Sort findings by file then line
  findings.sort((a, b) => (a.file.localeCompare(b.file) || ((a.line||0) - (b.line||0))));

  // Build unique index of URLs with locations
  const byUrl = new Map();
  for (const f of findings) {
    if (!byUrl.has(f.url)) byUrl.set(f.url, { type: f.type, locations: [] });
    byUrl.get(f.url).locations.push({ file: f.file, line: f.line });
  }

  // HTML output
  ensureDir(OUT_DIR);
  const dateStr = new Date().toISOString();
  const uniqueCount = byUrl.size;
  const pdfCount = Array.from(byUrl.values()).filter((v) => v.type === 'PDF').length;

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Alberta Curriculum Links (Internal Report)</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 24px; }
    h1 { margin-bottom: 8px; }
    .summary { color: #444; margin-bottom: 24px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 12px; border: 1px solid #ddd; margin-left: 8px; }
    .section { margin-top: 24px; }
    .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px; margin-bottom: 12px; }
    .loc { color: #6b7280; font-size: 12px; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .type-pdf { color: #dc2626; }
    .type-page { color: #059669; }
    code { background: #f3f4f6; padding: 2px 4px; border-radius: 4px; }
    ul { margin: 8px 0 0 18px; }
  </style>
  <meta name="robots" content="noindex,nofollow" />
  <meta name="internal" content="true" />
  <meta name="generated" content="${dateStr}" />
  <meta name="source" content="scripts/reports/generate-alberta-links.js" />
  <meta name="note" content="Lists publicly facing Alberta Government curriculum links used in the app." />
  
</head>
<body>
  <h1>Alberta Curriculum Links</h1>
  <div class="summary">
    Internal report of publicly facing Government of Alberta curriculum links used in the app and curriculum data. Generated: <strong>${dateStr}</strong>.
    <div>
      <span class="badge">Unique links: ${uniqueCount}</span>
      <span class="badge">PDFs: ${pdfCount}</span>
    </div>
  </div>

  <div class="section">
    <h2>Unique Links</h2>
    ${Array.from(byUrl.entries()).map(([url, info]) => {
      const typeClass = info.type === 'PDF' ? 'type-pdf' : 'type-page';
      const label = info.type === 'PDF' ? 'PDF' : 'Page';
      const locs = info.locations
        .map((l) => `<li><code>${l.file}${l.line ? ':'+l.line : ''}</code></li>`) 
        .join('');
      return `<div class="card">
        <div><a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a> <span class="badge ${typeClass}">${label}</span></div>
        <div class="loc">Used in:</div>
        <ul>${locs}</ul>
      </div>`;
    }).join('\n')}
  </div>

  <div class="section">
    <h2>By Source File</h2>
    ${findings.reduce((acc, f) => {
      acc[f.file] = acc[f.file] || [];
      acc[f.file].push(f);
      return acc;
    }, {}) && Object.entries(findings.reduce((acc, f) => {
      acc[f.file] = acc[f.file] || [];
      acc[f.file].push(f);
      return acc;
    }, {})).map(([file, items]) => {
      const list = items
        .filter((v, i, a) => a.findIndex(x => x.url === v.url && x.line === v.line) === i)
        .map((it) => `<li><a href="${it.url}" target="_blank" rel="noopener noreferrer">${it.url}</a> <span class="badge ${it.type === 'PDF' ? 'type-pdf' : 'type-page'}">${it.type}</span> ${it.line ? `<span class="loc">(line ${it.line})</span>` : ''}</li>`) 
        .join('');
      return `<div class="card"><div><strong>${file}</strong></div><ul>${list}</ul></div>`;
    }).join('\n')}
  </div>
</body>
</html>`;

  fs.writeFileSync(OUT_FILE, html, 'utf8');
  return { outFile: OUT_FILE, uniqueCount, pdfCount };
}

if (require.main === module) {
  try {
    const { outFile, uniqueCount, pdfCount } = generateReport();
    console.log(`Generated: ${path.relative(ROOT, outFile)} (unique: ${uniqueCount}, pdfs: ${pdfCount})`);
  } catch (e) {
    console.error('Failed to generate report:', e);
    process.exit(1);
  }
}

module.exports = { generateReport };

