import { expect, test } from '@playwright/test';
import { onboard, watchErrors } from './helpers';

/**
 * Phase 8: Growth Compass (discovery → target career → gap → plan waiting for approval),
 * Ask the System falling back calmly to the Compass, My data and What the System knows.
 */
test.use({ timezoneId: 'Asia/Kolkata' });

test('Growth Compass, Ask the System fallback, My data and the knowledge page', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await page.clock.install({ time: new Date('2026-11-02T10:00:00+05:30') });
  await onboard(page);

  // Career discovery → a target career → its gap → a plan to approve.
  await page.goto('/compass');
  const interests = page.getByRole('region', { name: 'What you enjoy' });
  await expect(interests.getByRole('group').first()).toBeVisible();
  for (const group of await interests.getByRole('group').all()) {
    const name = (await group.getAttribute('aria-label')) ?? '';
    const yes = /machine|tools|workshop|experiment|maths|hard problem/i.test(name);
    await group.getByRole('button', { name: yes ? 'Yes please' : 'Not for me' }).click();
  }
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Coding' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Creating new things' }).click();
  await page.getByRole('button', { name: 'See my matches' }).click();
  const matches = page.getByRole('region', { name: 'Careers that fit you' });
  await expect(matches).toContainText('Robotics engineer');
  await matches
    .getByRole('listitem')
    .filter({ hasText: 'Robotics engineer' })
    .getByRole('button', { name: /Work towards this/ })
    .click();
  const path = page.getByRole('region', { name: 'Your path' });
  await expect(path).toContainText(/hours of focused learning left/);
  await path.getByRole('button', { name: /Turn into a plan/ }).click();
  await expect(page.getByText('Plan waiting for review')).toBeVisible();

  // Ask the System is off by default → the Growth Compass answers, nothing is sent.
  await page.goto('/ask');
  await page.getByRole('textbox', { name: 'Your question' }).fill('How do I prepare for IELTS?');
  await page.getByRole('button', { name: 'Ask' }).click();
  await expect(page.getByRole('region', { name: 'Growth Compass' })).toContainText(
    'IELTS Academic',
  );

  // My data: nothing has ever left the device.
  await page.goto('/my-data');
  await expect(page.getByRole('region', { name: 'Sent outside ASCEND' })).toContainText(
    'Nothing, ever.',
  );
  await expect(page.getByRole('region', { name: 'Compact old history' })).toBeVisible();

  await page.goto('/knows');
  await expect(
    page.getByRole('heading', { name: 'What the System knows about you' }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
