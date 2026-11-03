import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '@/core/db/db';
import { clearSubscribers, newBase } from '@/core/pipeline';
import { startAppState } from '@/core/state/app';
import { INTEREST_ITEMS } from '@/data/compass/discovery';
import { Discovery } from './Discovery';

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
});
afterEach(() => clearSubscribers());

it('interests → strengths → values → matches with reasons; a target can be chosen', async () => {
  render(<Discovery />);
  for (const item of INTEREST_ITEMS) {
    const group = screen.getByRole('group', { name: item.text });
    const like = 'RI'.includes(item.type) ? 'Yes please' : 'Not for me';
    await userEvent.click(within(group).getByRole('button', { name: like }));
  }
  await userEvent.click(screen.getByRole('button', { name: 'Next' }));
  await userEvent.click(screen.getByRole('button', { name: 'Coding' }));
  await userEvent.click(screen.getByRole('button', { name: 'Next' }));
  await userEvent.click(screen.getByRole('button', { name: 'Creating new things' }));
  await userEvent.click(screen.getByRole('button', { name: 'See my matches' }));

  const results = await screen.findByRole('region', { name: 'Careers that fit you' });
  expect(within(results).getByText(/O\*NET OnLine/)).toBeInTheDocument();
  expect((await db.profile.get('profile'))?.compass?.discovery?.strengths).toEqual(['coding']);
  const first = within(results).getAllByRole('listitem')[0];
  expect(first).toHaveTextContent(/% fit/);
  await userEvent.click(
    within(first as HTMLElement).getByRole('button', { name: /Work towards this/ }),
  );
  await waitFor(async () =>
    expect((await db.profile.get('profile'))?.compass?.target_career).toBeTruthy(),
  );
}, 30_000);
