import { expect, type Page } from '@playwright/test';

/** Collects console errors and page crashes so every test can assert "no console errors". */
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

/** A fresh browser starts with onboarding: confirm the pre-filled answers. */
export async function onboard(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();
  // Four steps (no theme step): three Nexts, then Begin.
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Begin' }).click();
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
}

/** The card (list item) of a quest on Today, found by its title. */
export function questCard(page: Page, title: string) {
  return page.locator('li', { has: page.getByRole('heading', { name: title, exact: true }) });
}
