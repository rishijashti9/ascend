import { expect, test } from '@playwright/test';
import { onboard, watchErrors } from './helpers';

/**
 * Phase 7 end-to-end (web): sign-in is offered — optional — in Settings and on onboarding,
 * and the app keeps working without an account. (Signing in for real needs a person and an
 * email inbox / Google account; the sync rules themselves are covered by the SPEC 11 tests.)
 */
test('account: optional sign-in in onboarding and Settings, app works without it', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await page.getByText('Use ASCEND on another device? Sign in to bring your data here').click();
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();

  await onboard(page);
  await page.goto('/settings#account');
  const account = page.getByRole('region', { name: 'Account' });
  await expect(account).toContainText('ASCEND works fully without an account');
  await expect(account.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  await expect(account.getByLabel('Or get a sign-in link by email')).toBeVisible();
  // Backup lives in the Data & privacy group (UX-6): open it.
  await page.getByText('Data & privacy').click();
  await expect(page.getByRole('region', { name: 'Backup' })).toContainText(
    'Without sync (Account)',
  );
  expect(errors).toEqual([]);
});
