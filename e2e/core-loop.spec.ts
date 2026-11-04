import { expect, test } from '@playwright/test';
import { onboard, questCard, watchErrors } from './helpers';

/**
 * Phase 2 end-to-end tests (SPEC 11): onboarding, completing a quest, a low-energy day, and
 * export → wipe → import giving identical progress. Runs against the production build.
 * The browser clock is controlled so "the next day" can be tested without waiting.
 */
test.use({ timezoneId: 'Asia/Kolkata' });

const DAY1 = new Date('2026-11-02T10:00:00+05:30');
const DAY2_MORNING = new Date('2026-11-03T06:00:00+05:30');

test('onboarding: answers are saved and Today greets by name', async ({ page }) => {
  const errors = watchErrors(page);
  await page.clock.install({ time: DAY1 });
  await page.goto('/');
  await page.getByLabel('What should the System call you?').fill('Rishi J');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel('Wake-up time').fill('05:30');
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('radio', { name: /Elevate/ })).toBeChecked();
  await page.getByRole('button', { name: 'Begin' }).click();

  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
  await expect(page.getByText('Rishi J')).toBeVisible();
  await expect(page.getByText('Day 1', { exact: false }).first()).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'elevate');
  // The wake-up quest's wording follows the chosen time.
  await page.goto('/quests');
  await expect(page.getByText(/"I'm up" by 5:50 AM/)).toBeVisible();
  expect(errors).toEqual([]);
});

test('completing a quest awards XP', async ({ page }) => {
  await page.clock.install({ time: DAY1 });
  await onboard(page);
  const workout = questCard(page, 'Workout');
  await workout.getByRole('button', { name: 'Full' }).click();
  await expect(workout.getByText('Done · Full')).toBeVisible();
  await expect(workout.getByText('+25 XP')).toBeVisible();
  await expect(page.getByText(/^25 total$/)).toBeVisible();
  await expect(page.getByText('1 / 8 done')).toBeVisible();
});

test('low-energy day: only core minimums, and the day still counts', async ({ page }) => {
  await page.clock.install({ time: DAY1 });
  await onboard(page);
  // Next morning: Day 2 is the first day with core quests.
  await page.clock.setSystemTime(DAY2_MORNING);
  await page.reload();
  await expect(page.getByText(/Day 2/).first()).toBeVisible();

  await page.getByRole('button', { name: /Low energy/ }).click();
  await expect(page.getByRole('heading', { name: 'Journal', exact: true })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Show 5 hidden quests' })).toBeVisible();

  await page.getByRole('button', { name: /I’m up/ }).click(); // 6:00 → late check-in
  await expect(questCard(page, 'Wake up on time').getByText('Done · Late')).toBeVisible();
  await questCard(page, 'Workout').getByRole('button', { name: 'Minimum' }).click();
  const study = questCard(page, 'AI & Robotics study (phone-free)');
  await study.getByRole('button', { name: '+25 min' }).click();
  await expect(study.getByText(/^25 min/)).toBeVisible();
  await study.getByRole('button', { name: '+10 min' }).click();
  await expect(study.getByText('Done · Minimum')).toBeVisible();

  await expect(page.getByRole('status').first()).toContainText('Minimums met');
  await expect(page.getByLabel('Streak 1 day')).toBeVisible();
});

test('export → wipe → import gives identical progress', async ({ page }, testInfo) => {
  await page.clock.install({ time: DAY1 });
  await onboard(page);
  await page.clock.setSystemTime(DAY2_MORNING);
  await page.reload();
  await page.getByRole('button', { name: /I’m up/ }).click();
  await questCard(page, 'Workout').getByRole('button', { name: 'Full' }).click();
  await questCard(page, 'Journal').getByRole('button', { name: 'Minimum' }).click();
  await expect(page.getByText('3 / 8 done')).toBeVisible();
  // The XP total can update a moment after the done count: read it once it has settled
  // (late wake-up 13 + Workout 25 + Journal minimum 5).
  await expect(page.getByText(/^43 total$/)).toBeVisible();
  const before = await page.getByRole('region', { name: 'Status' }).innerText();

  await page.goto('/settings');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export my data' }).click();
  const file = testInfo.outputPath('backup.json');
  await (await download).saveAs(file);

  await page.getByRole('button', { name: 'Reset all data…' }).click();
  await page.getByRole('button', { name: 'Delete everything' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();

  await page.getByText('Already use ASCEND? Restore from a backup').click();
  await page.getByLabel(/Choose backup file/).setInputFiles(file);
  await page.getByRole('button', { name: 'Import' }).click();
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
  await expect(page.getByText('3 / 8 done')).toBeVisible();
  expect(await page.getByRole('region', { name: 'Status' }).innerText()).toBe(before);
});
