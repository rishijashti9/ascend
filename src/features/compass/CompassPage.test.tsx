import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { db } from '@/core/db/db';
import { clearSubscribers, newBase } from '@/core/pipeline';
import { adaptiveStore, computeAdaptive } from '@/core/state/adaptive';
import { startAppState } from '@/core/state/app';
import { testInput } from '@/test/adaptiveInput';
import { CompassPage } from './CompassPage';

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

it('Career: discovery, roadmaps with official links, browse careers; Health: the check-in', async () => {
  render(
    <MemoryRouter initialEntries={['/compass']}>
      <CompassPage />
    </MemoryRouter>,
  );
  expect(screen.getByRole('heading', { name: 'Find careers that fit you' })).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Roadmaps and guides' })).toHaveTextContent(
    'Master’s in Germany from India (APS route)',
  );
  expect(screen.getAllByRole('link', { name: /Check the official site/ }).length).toBeGreaterThan(
    3,
  );
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Field' }), 'trades');
  expect(screen.getByRole('region', { name: 'Browse careers' })).toHaveTextContent('Electrician');
  expect(screen.getAllByText(/CC BY 4\.0/).length).toBeGreaterThan(0);
  await userEvent.click(screen.getByRole('tab', { name: 'Health' }));
  expect(await screen.findByRole('region', { name: 'Health check-in' })).toBeInTheDocument();
}, 30_000);
