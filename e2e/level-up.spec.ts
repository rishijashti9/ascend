import { expect, test, type Page } from '@playwright/test';
import { onboard, questCard, watchErrors } from './helpers';

/**
 * Phase 5 end-to-end (SPEC 11 "level up"): finishing Day 1's quests crosses level 2 (178 XP):
 * the level-up moment appears, is skippable, and is never shown again after a reload.
 */
test.use({ timezoneId: 'Asia/Kolkata' });

const DAY1_EARLY = new Date('2026-11-02T05:00:00+05:30'); // before the 5:20 wake-up window ends

async function add(page: Page, title: string, amount: string) {
  const card = questCard(page, title);
  await card.getByRole('spinbutton').fill(amount);
  await card.getByRole('button', { name: /^(Add|Save)$/ }).click();
  await expect(card.getByText(/Done/)).toBeVisible();
}

test('level up: the moment shows once, can be skipped, and the level sticks', async ({ page }) => {
  const errors = watchErrors(page);
  await page.clock.install({ time: DAY1_EARLY });
  await onboard(page);

  await page.getByRole('button', { name: /I’m up/ }).click(); // on time: 25 XP
  for (const title of ['Workout', 'Journal']) {
    await questCard(page, title).getByRole('button', { name: 'Full' }).click();
    await expect(questCard(page, title).getByText('Done · Full')).toBeVisible();
  }
  await add(page, 'AI & Robotics study (phone-free)', '150');
  await add(page, 'Game dev study (phone-free)', '60');
  await add(page, 'Meditate', '10');
  await add(page, 'Walk', '8000');
  await expect(page.getByRole('dialog')).toBeHidden(); // still level 1 (155 XP)
  await add(page, 'Sleep', '7.5'); // 180 XP → level 2

  const moment = page.getByRole('dialog', { name: 'Level 2' });
  await expect(moment).toBeVisible();
  await expect(moment).toContainText('Level up');
  await expect(moment.getByRole('button', { name: 'Continue' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(moment).toBeHidden();
  await expect(page.getByRole('region', { name: 'Status' })).toContainText(/Level\s*2/);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Status' })).toContainText(/Level\s*2/);
  await expect(page.getByRole('dialog')).toBeHidden();
  expect(errors).toEqual([]);
});
