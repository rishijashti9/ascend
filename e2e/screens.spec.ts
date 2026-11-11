import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { onboard, questCard } from './helpers';

/**
 * Screenshots of every screen for the theme quality pass (Phase 12, task 12A.27): each route and
 * tab at 360 px, the key ones also at 768 and 1440. Skipped unless SCREENS_DIR is set, e.g.
 * `SCREENS_DIR=shots npx playwright test e2e/screens.spec.ts --project=laptop`.
 */
const dir = process.env.SCREENS_DIR;
test.skip(!dir, 'set SCREENS_DIR to take screenshots');
test.use({ timezoneId: 'Asia/Kolkata' });

const ROUTES = [
  '/',
  '/quests',
  '/focus',
  '/growth/goals',
  '/growth/compass',
  '/growth/compass?tab=health',
  '/growth/skills',
  '/growth/jobs',
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
const KEY = ['/', '/quests', '/focus', '/growth/goals', '/me/stats', '/settings'];
const WIDTHS = [360, 768, 1440];

const fileName = (path: string, width: number) =>
  `${width}-${path.replace(/[/?=]+/g, '_').replace(/^_|_$/g, '') || 'today'}.png`;

test('screenshots of every screen', async ({ page }) => {
  test.setTimeout(300_000);
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.clock.install({ time: new Date('2026-11-02T10:00:00+05:30') });
  await page.setViewportSize({ width: 360, height: 800 });
  await onboard(page);
  // Some real state: a finished quest and the job tracker on.
  await questCard(page, 'Workout')
    .getByRole('button', { name: 'Full' })
    .click({ timeout: 5000 })
    .catch(() => undefined);
  await page.goto('/settings#quests');
  await page.getByRole('switch', { name: 'Show the job tracker' }).click({ timeout: 10_000 });

  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: width < 1024 ? 800 : 900 });
    for (const path of width === 360 ? ROUTES : KEY) {
      await page.goto(path);
      await expect(page.locator('main').first()).toBeVisible({ timeout: 10_000 });
      await page.waitForTimeout(400); // let entrance motion settle
      await page.screenshot({ path: join(dir, fileName(path, width)), fullPage: true });
    }
  }
});
