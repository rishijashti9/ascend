import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

/** A 2×2 red PNG. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==',
  'base64',
);

/** Body photos stay on the device; "Export with photos" carries them to a new one. */
test('body photo: add → export with photos → reset → restore → delete', async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  await onboard(page);
  await page.goto('/body');
  await page
    .getByLabel(/Add today’s photo/)
    .setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByRole('button', { name: /Photo from/ })).toBeVisible({ timeout: 15_000 });

  await page.goto('/settings');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export with photos (.zip)' }).click();
  const file = testInfo.outputPath('with-photos.zip');
  await (await download).saveAs(file);

  await page.getByRole('button', { name: 'Reset all data…' }).click();
  await page.getByRole('button', { name: 'Delete everything' }).click();
  await page.getByText('Already use ASCEND? Restore from a backup').click();
  await page.getByLabel(/Choose backup file/).setInputFiles(file);
  await expect(page.getByText(/1 photo\./)).toBeVisible();
  await page.getByRole('button', { name: 'Import' }).click();
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();

  await page.goto('/body');
  await page.getByRole('button', { name: /Photo from/ }).click({ timeout: 15_000 });
  await expect(page.getByRole('img', { name: /Body photo from/ })).toBeVisible();
  await page.getByRole('button', { name: 'Delete photo…' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('button', { name: /Photo from/ })).toBeHidden();
});
