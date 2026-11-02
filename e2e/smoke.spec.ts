import { expect, test } from '@playwright/test';
import { onboard, watchErrors } from './helpers';

test('first visit: onboarding, then Today, with no console errors', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('navigation: Today → More → Settings shows the version', async ({ page, isMobile }) => {
  await onboard(page);
  if (isMobile) {
    const bar = page.getByRole('navigation', { name: 'Main' }).last();
    await expect(bar).toBeVisible();
    await bar.getByRole('link', { name: 'More' }).click();
    await page.getByRole('main').getByRole('link', { name: 'Settings' }).click();
  } else {
    const sidebar = page.getByRole('navigation', { name: 'Main' }).first();
    await expect(sidebar).toBeVisible();
    await sidebar.getByRole('link', { name: 'Settings' }).click();
  }
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(page.getByText(/^\d+\.\d+\.\d+$/)).toBeVisible();
});

test('follows the dark system theme', async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: 'dark' });
  const page = await context.newPage();
  await page.goto(test.info().project.use.baseURL ?? '/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await context.close();
});

test('keeps working offline after the first visit', async ({ page, context }) => {
  await onboard(page);
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // On a first visit the service worker takes control after one reload.
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
  await context.setOffline(false);
});

test('unknown addresses go back to Today', async ({ page }) => {
  await onboard(page);
  await page.goto('/this-page-does-not-exist');
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});
