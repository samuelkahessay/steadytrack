import { describe, expect, it } from 'vitest';
import nextConfig from '../next.config';

// The archived app is shown inside an archive frame on skahessay.dev, so it
// must allow exactly that ancestor and stay out of search indexes.
describe('archive response headers', () => {
  async function headerRules() {
    const rules = await nextConfig.headers!();
    return rules.map((rule) => ({
      source: rule.source,
      headers: Object.fromEntries(rule.headers.map((header) => [header.key, header.value])),
    }));
  }

  it('allows framing by skahessay.dev on every CSP it sends', async () => {
    const rules = await headerRules();
    const policies = rules
      .map((rule) => rule.headers['Content-Security-Policy'])
      .filter(Boolean);

    expect(policies.length).toBeGreaterThan(0);
    for (const policy of policies) {
      const directive = policy.split('; ').find((entry) => entry.startsWith('frame-ancestors '));
      // Outside production the config also allows localhost for frame testing.
      const sources = directive!.split(' ').slice(1).filter((source) => source !== 'http://localhost:*');
      expect(sources).toEqual(["'self'", 'https://skahessay.dev']);
    }
  });

  it('does not send X-Frame-Options, which cannot express an allow-list', async () => {
    const rules = await headerRules();
    for (const rule of rules) {
      expect(rule.headers).not.toHaveProperty('X-Frame-Options');
    }
  });

  it('marks every route noindex', async () => {
    const rules = await headerRules();
    const catchAll = rules.find((rule) => rule.source === '/(.*)');
    expect(catchAll?.headers['X-Robots-Tag']).toBe('noindex');
  });
});
