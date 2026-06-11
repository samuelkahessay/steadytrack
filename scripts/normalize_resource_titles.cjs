#!/usr/bin/env node
/*
 Normalizes resource titles in data/curriculum/*.json by removing
 provider suffixes/prefixes, chapter numbers, and stray tokens.
 Mirrors logic in lib/utils/title.ts (kept independent to run in Node).
*/

const fs = require('fs');
const path = require('path');

function safeHostname(url) {
  try { return new URL(url).hostname.toLowerCase(); } catch { return ''; }
}

function cleanResourceTitle(rawTitle, url) {
  if (!rawTitle || typeof rawTitle !== 'string') return rawTitle;
  let t = String(rawTitle).trim();

  // Collapse whitespace
  t = t.replace(/\s+/g, ' ');

  // Remove weird leading single-letter tokens (e.g., "X D D Df E ...")
  t = t.replace(/^(?:[A-Z]{1,2}\s+){2,6}/, '');

  // Remove leading chapter/section numbering like "7.2 " or "10.1 "
  t = t.replace(/^\d+(?:\.\d+)*\s+/, '');

  const host = safeHostname(url || '');

  if (host.endsWith('openstax.org')) {
    t = t.replace(/\s*[|\-–—]\s*Chemistry\s*\d+e$/i, '');
    t = t.replace(/\s*[|\-–—]\s*(Biology|Physics|Algebra|U\.S\. History|College [A-Za-z]+)(?:\s*\d+e)?$/i, '');
    t = t.replace(/\s*[|\-–—]\s*OpenStax$/i, '');
  }

  if (host.includes('khanacademy.org')) {
    t = t.replace(/\s*[|\-–—]\s*Khan Academy$/i, '');
  }

  if (host.includes('owl.purdue.edu') || host.includes('purdue.edu')) {
    t = t.replace(/\s*[|\-–—]\s*Purdue OWL\s*(?:[|\-–—]\s*Purdue University)?$/i, '');
    t = t.replace(/\s*[|\-–—]\s*Purdue University$/i, '');
  }

  if (host.includes('libretexts.org')) {
    t = t.replace(/\s*[|\-–—]\s*(?:[A-Za-z]+\s+)?LibreTexts$/i, '');
  }

  if (host.includes('colorado.edu')) {
    t = t.replace(/\s*[|\-–—]\s*PhET$/i, '');
  }

  // Generic cleanup
  t = t.replace(/\s*[|\-–—]\s*(Khan Academy|OpenStax|LibreTexts|Purdue OWL|Purdue University)\s*$/i, '');

  t = t.trim().replace(/\s{2,}/g, ' ');
  return t.length ? t : rawTitle;
}

function processFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error('Skipping invalid JSON:', filePath);
    return { changed: 0, total: 0 };
  }

  if (!data || !Array.isArray(data.units)) return { changed: 0, total: 0 };

  let changed = 0;
  let total = 0;

  for (const unit of data.units) {
    if (!unit || !Array.isArray(unit.resources)) continue;
    for (const r of unit.resources) {
      if (!r || typeof r.title !== 'string') continue;
      total += 1;
      const newTitle = cleanResourceTitle(r.title, r.url || '');
      if (newTitle !== r.title) {
        r.title = newTitle;
        changed += 1;
      }
    }
  }

  if (changed > 0) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
  }

  return { changed, total };
}

function main() {
  const dir = path.join(process.cwd(), 'data', 'curriculum');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  let grandChanged = 0;
  let grandTotal = 0;

  for (const f of files) {
    const p = path.join(dir, f);
    const { changed, total } = processFile(p);
    if (changed > 0) {
      console.log(`${f}: cleaned ${changed}/${total}`);
    }
    grandChanged += changed;
    grandTotal += total;
  }

  console.log(`Done. Cleaned ${grandChanged}/${grandTotal} titles.`);
}

if (require.main === module) {
  main();
}

