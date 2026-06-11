#!/usr/bin/env node
/*
 Checks all Alberta document links referenced in data/curriculum/* for validity.
 - Follows redirects, records final URL, status, and content-type
 - For PDFs: expect application/pdf (or octet-stream) and 200
 - For HTML: parse <title> and look for relevant keywords (Alberta, Program of Studies)
 Outputs a concise report with PASS/FAIL per link.
*/

const fs = require('fs');
const path = require('path');

async function fetchWithTimeout(resource, options = {}) {
  const { timeout = 15000 } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(resource, { ...options, signal: controller.signal, redirect: 'follow' });
    return res;
  } finally {
    clearTimeout(id);
  }
}

function readCurriculumDocs() {
  const dir = path.join(process.cwd(), 'data', 'curriculum');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  const links = [];

  for (const f of files) {
    try {
      const raw = fs.readFileSync(path.join(dir, f), 'utf8');
      const data = JSON.parse(raw);
      const subject = data?.subject || f.replace(/\.json$/, '');
      if (Array.isArray(data?.albertaDocs)) {
        for (const doc of data.albertaDocs) {
          if (doc && typeof doc.url === 'string') {
            links.push({ subject, title: doc.title || '(untitled)', url: doc.url });
          }
        }
      }
    } catch (e) {
      console.warn('Skipping invalid JSON:', f);
    }
  }

  // Deduplicate by URL
  const uniq = new Map();
  for (const l of links) {
    if (!uniq.has(l.url)) uniq.set(l.url, l);
  }
  return Array.from(uniq.values());
}

function looksLikeAlbertaDomain(urlStr) {
  try {
    const u = new URL(urlStr);
    return /(^|\.)alberta\.ca$/i.test(u.hostname) || /(^|\.)education\.alberta\.ca$/i.test(u.hostname);
  } catch {
    return false;
  }
}

function classify(contentType) {
  const ct = (contentType || '').toLowerCase();
  if (ct.includes('pdf')) return 'pdf';
  if (ct.includes('html')) return 'html';
  if (!ct && typeof contentType === 'undefined') return 'unknown';
  return 'other';
}

async function validateLink(link) {
  const result = { ...link, ok: false, status: 0, finalUrl: '', contentType: '', notes: [] };
  try {
    const res = await fetchWithTimeout(link.url, { timeout: 20000 });
    result.status = res.status;
    result.finalUrl = res.url;
    result.contentType = res.headers.get('content-type') || '';

    const isAlberta = looksLikeAlbertaDomain(result.finalUrl);
    if (!isAlberta) result.notes.push('Final URL not on Alberta domain');

    const kind = classify(result.contentType);
    if (kind === 'pdf') {
      if (res.ok) {
        result.ok = true;
      } else {
        result.notes.push('Non-OK status for PDF');
      }
    } else if (kind === 'html') {
      const text = await res.text();
      const titleMatch = text.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : '';
      const matchesKeyword = /alberta|program of studies|curriculum/i.test(title);
      if (!title) result.notes.push('Missing <title>');
      if (!matchesKeyword) result.notes.push('Title lacks expected keywords');
      if (res.ok && (isAlberta || matchesKeyword)) {
        result.ok = true;
      }
    } else {
      if (res.ok) {
        // Accept other content-types if status OK and on Alberta domain
        result.ok = looksLikeAlbertaDomain(result.finalUrl);
        if (!result.ok) result.notes.push('Unknown content-type and non-Alberta domain');
      } else {
        result.notes.push('Non-OK status');
      }
    }
  } catch (e) {
    result.notes.push(`Request error: ${e?.name || 'Error'}`);
  }
  return result;
}

async function main() {
  const links = readCurriculumDocs();
  if (links.length === 0) {
    console.log('No Alberta documents found in curriculum data.');
    return;
  }

  console.log(`Checking ${links.length} unique Alberta document links...`);

  const results = [];
  const concurrency = 5;
  let idx = 0;

  async function worker() {
    while (idx < links.length) {
      const i = idx++;
      const r = await validateLink(links[i]);
      results.push(r);
      const status = r.ok ? 'PASS' : 'FAIL';
      console.log(`${status} ${r.url} -> ${r.finalUrl} [${r.status} ${r.contentType || 'unknown'}] ${r.notes.length ? '- ' + r.notes.join('; ') : ''}`);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  const pass = results.filter(r => r.ok).length;
  const fail = results.length - pass;
  console.log(`\nSummary: PASS ${pass} / ${results.length}, FAIL ${fail}`);
}

if (require.main === module) {
  // Node 18+ has fetch globally. For older, users can run with node --experimental-fetch.
  if (typeof fetch !== 'function') {
    console.error('This script requires Node 18+ with global fetch.');
    process.exit(1);
  }
  main();
}

