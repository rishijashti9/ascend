import { expect, test } from '@playwright/test';
import { onboard, watchErrors } from './helpers';

/**
 * Phase 6 end-to-end (web): Settings says honestly what a browser can do, a test reminder
 * shows as an in-app banner, and a reminder that comes due while ASCEND is open appears too.
 */
test.use({ timezoneId: 'Asia/Kolkata' });

test('notifications on the web: honest settings, test banner, a due reminder', async ({ page }) => {
  const errors = watchErrors(page);
  await page.clock.install({ time: new Date('2026-11-02T20:59:00+05:30') });
  await onboard(page);
  await page.goto('/settings');
  const card = page.getByRole('region', { name: 'Notifications' });
  await expect(card).toContainText('reminders appear only while ASCEND is open');
  await card.getByRole('button', { name: 'Send a test' }).click();
  const banner = page.getByRole('status').filter({ hasText: 'Notifications are working.' });
  await expect(banner).toBeVisible();
  await banner.getByRole('button', { name: 'Dismiss reminder' }).click();
  await expect(banner).toBeHidden();

  // 21:00 wind-down comes due while the app is open → banner with a way to the check-in.
  await page.clock.runFor(2 * 60_000);
  const wind = page.getByRole('status').filter({ hasText: 'Time to wind down.' });
  await expect(wind).toBeVisible();
  await wind.getByRole('button', { name: 'Open' }).click();
  await expect(page.getByRole('heading', { name: 'Review' })).toBeVisible();
  expect(errors).toEqual([]);
});
