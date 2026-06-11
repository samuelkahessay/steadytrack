/**
 * Cleans up resource titles for display by removing
 * provider suffixes/prefixes, chapter numbers, and stray tokens.
 * Heuristics are conservative and provider-aware based on URL.
 */
export function cleanResourceTitle(rawTitle: string, url: string): string {
  if (!rawTitle) return rawTitle;
  let t = String(rawTitle).trim();

  // Collapse whitespace
  t = t.replace(/\s+/g, ' ');

  // Remove weird leading single-letter tokens (e.g., "X D D Df E ...")
  t = t.replace(/^(?:[A-Z]{1,2}\s+){2,6}/, '');

  // Remove leading chapter/section numbering like "7.2 " or "10.1 "
  t = t.replace(/^\d+(?:\.\d+)*\s+/, '');

  const host = safeHostname(url);

  // Provider-specific suffix/prefix cleanup
  if (host.endsWith('openstax.org')) {
    // Remove trailing book name like "- Chemistry 2e" or similar OpenStax book strings
    t = t.replace(/\s*[|\-–—]\s*Chemistry\s*\d+e$/i, '');
    t = t.replace(/\s*[|\-–—]\s*(Biology|Physics|Algebra|U\.S\. History|College [A-Za-z]+)(?:\s*\d+e)?$/i, '');
    // Generic OpenStax suffix
    t = t.replace(/\s*[|\-–—]\s*OpenStax$/i, '');
  }

  if (host.includes('khanacademy.org')) {
    // Common KA suffix formats
    t = t.replace(/\s*[|\-–—]\s*Khan Academy$/i, '');
  }

  if (host.includes('owl.purdue.edu') || host.includes('purdue.edu')) {
    // Remove "- Purdue OWL - Purdue University" or similar
    t = t.replace(/\s*[|\-–—]\s*Purdue OWL\s*(?:[|\-–—]\s*Purdue University)?$/i, '');
    t = t.replace(/\s*[|\-–—]\s*Purdue University$/i, '');
  }

  if (host.includes('libretexts.org')) {
    // Remove "- LibreTexts" or "- Chemistry LibreTexts"
    t = t.replace(/\s*[|\-–—]\s*(?:[A-Za-z]+\s+)?LibreTexts$/i, '');
  }

  if (host.includes('colorado.edu')) {
    // PhET
    t = t.replace(/\s*[|\-–—]\s*PhET$/i, '');
  }

  // Generic cleanup: remove duplicated separators to a neat title
  t = t.replace(/\s*[|\-–—]\s*(Khan Academy|OpenStax|LibreTexts|Purdue OWL|Purdue University)\s*$/i, '');

  // Final trim and collapse extra spaces
  t = t.trim().replace(/\s{2,}/g, ' ');

  return t;
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

