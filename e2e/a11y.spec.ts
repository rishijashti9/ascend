import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { onboard } from './helpers';

/**
 * Accessibility pass (SPEC 8, task 10.5): every screen is checked with axe (WCAG 2.1 A + AA) in
 * light and dark, at phone and laptop sizes (the two projects). Any violation fails the test
 * and is listed with the element it was found on.
 */
test.use({ timezoneId: 'Asia/Kolkata' });

const SCREENS = [
  '/',
  '/quests',
  '/focus',
  '/goals',
  '/body',
  '/review',
  '/review?tab=weekly',
  '/skills',
  '/jobs',
  '/profile',
  '/settings',
  '/more',
];

async function violations(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return result.violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help} — ${v.nodes
        .map((n) => n.target.join(' '))
        .slice(0, 3)
        .join(' | ')}`,
  );
}

/** Buttons, switches and form controls smaller than 44 × 44 px (SPEC 8: tap targets ≥ 44px). */
async function smallTargets(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const nodes = document.querySelectorAll<HTMLElement>(
      'button, [role="switch"], [role="radio"], [role="tab"], select, input:not([type="hidden"]):not(.sr-only), textarea',
    );
    for (const el of nodes) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue; // not shown
      if (el.closest('[aria-hidden="true"]')) continue;
      if (r.height < 43.5 || r.width < 43.5) {
        const name =
          el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 40) ?? el.tagName;
        out.push(
          `${el.tagName.toLowerCase()} "${name}" ${Math.round(r.width)}×${Math.round(r.height)}`,
        );
      }
    }
    return [...new Set(out)].slice(0, 10);
  });
}

for (const scheme of ['light', 'dark'] as const) {
  test(`every screen passes axe (${scheme})`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ colorScheme: scheme });
    await page.clock.install({ time: new Date('2026-11-02T10:00:00+05:30') });
    await onboard(page);
    // Switch the job tracker on so the Jobs screen is real.
    await page.goto('/settings');
    await page.getByRole('switch', { name: 'Show the job tracker' }).click();

    const found: string[] = [];
    for (const path of SCREENS) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      for (const v of await violations(page)) found.push(`${path}: ${v}`);
      for (const t of await smallTargets(page)) found.push(`${path}: target under 44px — ${t}`);
    }
    expect(found).toEqual([]);
  });
}
