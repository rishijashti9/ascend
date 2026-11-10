import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

/**
 * UX-1 (docs/product/AUDIT-AND-PROPOSAL.md, P2): no screen may scroll sideways on a phone.
 * Runs at the smallest supported width (360 px) on every screen; on failure it names the
 * elements that stick out, so the fix is obvious.
 */
test.use({ viewport: { width: 360, height: 800 }, timezoneId: 'Asia/Kolkata' });

const ROUTES = [
  '/',
  '/quests',
  '/quests?tab=weekly',
  '/quests?tab=side',
  '/focus',
  '/growth/goals',
  '/growth/roadmap',
  '/growth/roadmap?tab=health',
  '/growth/skills',
  '/me/stats',
  '/me/body',
  '/me/reviews',
  '/me/reviews?tab=weekly',
  '/me/screen-time',
  '/me/knows',
  '/my-data',
  '/ask',
  '/settings',
];

test('no screen scrolls sideways at 360 px', async ({ page }) => {
  test.setTimeout(120_000);
  await onboard(page);
  const problems: string[] = [];
  for (const path of ROUTES) {
    await page.goto(path);
    await expect(page.locator('main').first()).toBeVisible();
    await page.waitForTimeout(300);
    const result = await page.evaluate(() => {
      const width = document.documentElement.clientWidth;
      const scroll = document.documentElement.scrollWidth;
      const culprits = [...document.querySelectorAll<HTMLElement>('main *')]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.right > width + 1;
        })
        .slice(0, 3)
        .map(
          (el) => `<${el.tagName.toLowerCase()} class="${el.className.toString().slice(0, 60)}">`,
        );
      return { width, scroll, culprits };
    });
    if (result.scroll > result.width)
      problems.push(`${path}: ${result.scroll}px > ${result.width}px ${result.culprits.join(' ')}`);
  }
  expect(problems).toEqual([]);
});

test('Ask the System sits in the header of every main screen, and nothing floats over content', async ({
  page,
}) => {
  await onboard(page);
  for (const path of ['/', '/quests', '/focus', '/growth/goals', '/me/stats']) {
    await page.goto(path);
    const ask = page.getByRole('button', { name: 'Ask the System' });
    await expect(ask, path).toBeVisible();
    // In the page flow, not fixed on top of it.
    expect(await ask.evaluate((el) => getComputedStyle(el).position), path).not.toBe('fixed');
  }
  for (const path of ['/settings', '/my-data']) {
    await page.goto(path);
    await expect(page.getByRole('button', { name: 'Ask the System' }), path).toHaveCount(0);
  }
  // The only fixed elements on a main screen are the bottom navigation (and its contents).
  await page.goto('/quests');
  const floating = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('body *')]
      .filter((el) => getComputedStyle(el).position === 'fixed' && el.offsetParent !== null)
      .filter((el) => !el.closest('nav'))
      .map((el) => el.outerHTML.slice(0, 80)),
  );
  expect(floating).toEqual([]);
});
