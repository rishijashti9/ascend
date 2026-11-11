import { expect, test } from '@playwright/test';
import { onboard, watchErrors } from './helpers';

/**
 * Phase 11: Screen Time is phone-only. In the browser (the laptop) it says so plainly, never
 * shows a setup it can't do, and the Screen time screen is reachable from More.
 */
test.use({ timezoneId: 'Asia/Kolkata' });

test('Screen time: honest phone-only note on the laptop, screen reachable, nothing on Today', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await page.clock.install({ time: new Date('2026-11-04T10:00:00+05:30') });
  await onboard(page);

  // Off by default: nothing about screen time on Today.
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
  await expect(page.getByText(/Entertainment today|observing quietly/)).toHaveCount(0);

  await page.goto('/settings#screen-time');
  const card = page.getByRole('region', { name: 'Screen time' });
  await expect(card).toContainText('Screen time works in the ASCEND Android app');
  await expect(card).toContainText('it never blocks anything');
  await expect(card.getByRole('button', { name: 'Allow screen time' })).toHaveCount(0);

  await page.goto('/me');
  await page.getByRole('link', { name: /^Screen time/ }).click();
  await expect(page.getByRole('heading', { name: 'Screen time' })).toBeVisible();
  await expect(page.getByText('Screen time is off.')).toBeVisible();
  expect(errors).toEqual([]);
});
