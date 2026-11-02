import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

/**
 * Phase 3 end-to-end (PLAN 3.10): plan a goal saved during onboarding, approve it, change the
 * goal (pause) → the planner proposes what to do with its quests → approve → undo.
 */
test.use({ timezoneId: 'Asia/Kolkata' });

test('goal → planner → approve → change → approve → undo', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-02T10:00:00+05:30') });
  await onboard(page);

  // Today invites planning the goals from onboarding.
  const nudges = page.getByRole('navigation', { name: 'Goals that need a look' });
  await nudges.getByRole('link', { name: /Core robotics skills: needs a plan/ }).click();

  // The planner: analysis → questions (defaults) → preview → approve.
  const sheet = page.getByRole('dialog', { name: 'Core robotics skills' });
  await sheet.getByRole('button', { name: 'Next' }).click();
  await sheet.getByRole('button', { name: 'Make my plan' }).click();
  const preview = sheet.getByRole('region', { name: 'Plan waiting for review' });
  await expect(preview).toContainText('Link “AI & Robotics study (phone-free)” to this goal');
  await preview.getByRole('button', { name: 'Approve all' }).click();
  await expect(sheet).toBeHidden();
  await expect(
    page.getByRole('heading', { name: 'Core robotics skills: foundations' }),
  ).toBeVisible();

  // A meaningful change: pause the goal → a proposal for its linked daily quest.
  await page.getByRole('button', { name: 'Pause', exact: true }).first().click(); // the goal's (milestones have one too)
  const proposal = page.getByRole('region', { name: 'Plan waiting for review' });
  await expect(proposal).toContainText('Pause “AI & Robotics study (phone-free)”');
  await proposal.getByRole('button', { name: 'Approve all' }).click();
  await expect(proposal).toBeHidden();

  await page.goto('/quests');
  const paused = page.getByRole('heading', { name: /^Paused/ });
  await expect(paused).toBeVisible();

  // Undo that plan from Plan history (newest first).
  await page.goto('/goals');
  const history = page.getByRole('region', { name: 'Plan history' });
  await history.getByRole('button', { name: /Undo/ }).first().click();
  await expect(history.getByText(/undone/).first()).toBeVisible();
  await page.goto('/quests');
  await expect(
    page.getByRole('heading', { name: 'AI & Robotics study (phone-free)' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Paused/ })).toBeHidden();
});
