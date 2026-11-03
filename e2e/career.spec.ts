import { expect, test } from '@playwright/test';
import { onboard, watchErrors } from './helpers';

/** Phase 9: skill tree fed by a tagged focus session; job tracker switched on → application → XP. */
test.use({ timezoneId: 'Asia/Kolkata' });

test('career tools: skills from focus time, then an application gives INT XP', async ({ page }) => {
  const errors = watchErrors(page);
  await page.clock.install({ time: new Date('2026-11-02T10:00:00+05:30') });
  await onboard(page);

  // The starter roadmap is there; no study time linked yet.
  await page.goto('/skills');
  await expect(page.getByRole('region', { name: 'Robotics' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Study balance' })).toContainText(
    'No AI & Robotics or Games study time',
  );

  // A focus session tagged with ROS 2 (not linked to a quest: 1 XP per minute).
  await page.goto('/focus');
  await page.getByRole('radio', { name: /No quest/ }).click();
  await page.getByRole('button', { name: /^Skills:/ }).click();
  await page.getByRole('button', { name: 'ROS 2', exact: true }).click();
  await page.getByRole('button', { name: /Start 25-minute focus/ }).click();
  await expect(page.getByRole('timer')).toBeVisible();
  await page.clock.fastForward('26:00');
  await page.getByRole('button', { name: 'Yes' }).click();
  await expect(page.getByRole('dialog', { name: 'Focus session' })).toBeHidden();

  await page.goto('/skills');
  await expect(page.getByRole('button', { name: /^ROS 2, level 0 of 5, 0.4 hours/ })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Study balance' })).toContainText('100 / 0');

  // Jobs stay hidden until switched on in Settings.
  await page.goto('/more');
  await expect(page.getByRole('link', { name: 'Jobs' })).toHaveCount(0);
  await page.goto('/settings');
  await page.getByRole('switch', { name: 'Show the job tracker' }).click();
  await page.goto('/more');
  await page.getByRole('link', { name: 'Jobs' }).last().click();

  await page.getByRole('button', { name: 'Add application' }).click();
  const form = page.getByRole('form', { name: 'New application' });
  await form.getByLabel('Company').fill('Agile Robots');
  await form.getByLabel('Role').fill('Robotics intern');
  await form.getByRole('button', { name: 'Add application' }).click();
  await expect(
    page.getByRole('article', { name: 'Agile Robots, Robotics intern' }).first(),
  ).toBeVisible();

  // 25 XP from focus + 10 XP from the automatic "Applied" side quest.
  await page.goto('/');
  await expect(page.getByText(/^35 total$/)).toBeVisible();
  expect(errors).toEqual([]);
});
