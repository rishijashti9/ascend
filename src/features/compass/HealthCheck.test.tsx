import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { db } from '@/core/db/db';
import { clearSubscribers, newBase } from '@/core/pipeline';
import { adaptiveStore, computeAdaptive } from '@/core/state/adaptive';
import { startAppState } from '@/core/state/app';
import { testInput } from '@/test/adaptiveInput';
import { HealthCheck } from './HealthCheck';

beforeEach(async () => {
  await db.delete();
  await db.open();
  await db.profile.put({
    ...newBase('profile'),
    name: 'R',
    start_day: '2026-11-02',
    onboarded_at: '2026-11-02T00:00:00.000Z',
    display_title: null,
  });
  await startAppState();
  adaptiveStore.setState(computeAdaptive(testInput()));
});
afterEach(() => clearSubscribers());

it('check-in → health picture against the guidelines, with sources and the not-medical-advice note', async () => {
  render(
    <MemoryRouter>
      <HealthCheck />
    </MemoryRouter>,
  );
  const click = (name: string) => userEvent.click(screen.getByRole('button', { name }));
  await click('A little');
  await click('1');
  await click('6–7 h');
  await click('OK');
  await click('Get stronger');
  await click('See my health picture');
  const picture = await screen.findByRole('region', { name: 'Your health picture' });
  expect(picture).toHaveTextContent('Muscle strengthening');
  expect(picture).toHaveTextContent('1 strength day a week (your check-in).');
  expect(picture).toHaveTextContent(/World Health Organization/);
  expect(picture).toHaveTextContent(/not medical advice/);
  await waitFor(async () =>
    expect((await db.profile.get('profile'))?.compass?.health).toMatchObject({ strengthDays: 1 }),
  );
}, 30_000);
