import { expect, test } from '@playwright/test';
import { onboard, watchErrors } from './helpers';

/**
 * Hardening V-03: every page is served with the production security headers (vercel.json, also
 * sent by `vite preview`), and no screen breaks the Content-Security-Policy.
 */
const ROUTES = [
  '/',
  '/quests',
  '/focus',
  '/growth/goals',
  '/growth/roadmap',
  '/growth/roadmap?tab=health',
  '/growth/skills',
  '/me/stats',
  '/me/body',
  '/me/reviews',
  '/me/reviews?tab=weekly',
  '/me/knows',
  '/my-data',
  '/ask',
  '/settings',
];

test('pages carry the security headers', async ({ request }) => {
  for (const path of ['/', '/settings', '/privacypolicy.html']) {
    const res = await request.get(path);
    expect(res.ok()).toBe(true);
    const h = res.headers();
    expect(h['content-security-policy']).toContain("default-src 'self'");
    expect(h['content-security-policy']).toContain("script-src 'self';");
    expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(h['content-security-policy']).toContain("object-src 'none'");
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['x-frame-options']).toBe('DENY');
    expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(h['permissions-policy']).toContain('camera=()');
  }
});

test('no screen violates the Content-Security-Policy', async ({ page }) => {
  // 15 full page loads: ~13 s locally, but against the live site (E2E_BASE_URL) the network can
  // push it past the default 30 s.
  test.setTimeout(90_000);
  const errors = watchErrors(page);
  await page.addInitScript(() => {
    const w = window as unknown as { __cspViolations: string[] };
    w.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (e) =>
      w.__cspViolations.push(`${e.violatedDirective} ${e.blockedURI}`),
    );
  });
  await onboard(page);
  const violations: string[] = [];
  for (const path of ROUTES) {
    await page.goto(path);
    await expect(page.locator('main')).toBeVisible();
    violations.push(
      ...(await page.evaluate(
        () => (window as unknown as { __cspViolations: string[] }).__cspViolations,
      )),
    );
  }
  expect(violations).toEqual([]);
  expect(errors.filter((e) => /Content Security Policy|Refused to/i.test(e))).toEqual([]);
});
