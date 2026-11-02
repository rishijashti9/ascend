import { expect, test } from '@playwright/test';
import { onboard, questCard } from './helpers';

/** SPEC 4.8: a focus session linked to a quest gives that quest's XP — never a second award. */
test.use({ timezoneId: 'Asia/Kolkata' });

test('focus linked to a quest: minutes go to the quest, XP is not doubled', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-02T10:00:00+05:30') });
  await onboard(page);
  await page.getByRole('link', { name: 'Start focus' }).click();
  await page.getByRole('radio', { name: /Meditate/ }).click();
  await page.getByRole('button', { name: /Start 25-minute focus/ }).click();
  await expect(page.getByRole('timer')).toBeVisible();

  await page.clock.fastForward('26:00');
  await page.getByRole('button', { name: 'Yes' }).click();
  await expect(page.getByRole('dialog', { name: 'Focus session' })).toBeHidden();

  await page.goto('/');
  // Meditate is Easy (10 XP); 25 focused minutes complete its 10-minute target once.
  await expect(questCard(page, 'Meditate').getByText('Done · Full')).toBeVisible();
  await expect(page.getByText(/^10 total$/)).toBeVisible();
});
