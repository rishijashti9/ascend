import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import type { Dream, MainQuest } from '@/core/db/types';
import { db } from '@/core/db/db';
import { clearSubscribers, recordAction } from '@/core/pipeline';
import { startAppState } from '@/core/state/app';
import { startGoals } from '@/core/state/goals';
import { startProgressStore } from '@/core/state/progress';
import { startQuests } from '@/core/state/quests';
import { startToday } from '@/core/state/today';
import { resetClock, setNow, setTimeZoneOverride } from '@/core/time';
import { ThisWeek } from '@/features/today/ThisWeek';
import { ist } from '@/test/testDb';
import { QuestsPage } from './QuestsPage';

async function start(ui: React.ReactNode, path = '/quests?tab=weekly') {
  await startAppState();
  await startGoals();
  await startQuests();
  await startToday();
  await startProgressStore();
  render(<MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>);
}

beforeEach(async () => {
  await db.delete();
  await db.open();
  setTimeZoneOverride('Asia/Kolkata');
  setNow(ist(2026, 11, 4, 10)); // Wednesday
});
afterEach(() => {
  clearSubscribers();
  resetClock();
});

describe('Weekly and Side tabs', () => {
  it('creates a weekly quest linked to a main quest, then archives it', async () => {
    const dream = (await recordAction<Dream>({ type: 'dream.create', payload: { title: 'D' } }))
      .value as Dream;
    await recordAction<MainQuest>({
      type: 'mainQuest.create',
      payload: { dream_id: dream.id, title: 'MS in Germany', stat: 'INT' },
    });
    await start(<QuestsPage />);
    expect(screen.getByRole('tab', { name: 'Weekly' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText(/No weekly quests this week/)).toBeInTheDocument();
    expect(screen.getByText(/from 2 Nov 2026/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'New quest' }));
    const form = screen.getByRole('form', { name: 'New weekly quest' });
    await userEvent.type(within(form).getByLabelText('Title'), 'Two mock tests');
    await userEvent.selectOptions(within(form).getByLabelText('Done when'), 'count');
    await userEvent.selectOptions(within(form).getByLabelText('Toward goal'), 'MS in Germany');
    await userEvent.click(within(form).getByRole('button', { name: 'Add quest' }));

    const row = (await screen.findByRole('heading', { name: 'Two mock tests' })).closest(
      'li',
    ) as HTMLElement;
    expect(row).toHaveTextContent('3 · For: MS in Germany');
    await userEvent.click(within(row).getByRole('button', { name: 'Edit Two mock tests' }));
    await userEvent.click(within(row).getByRole('button', { name: 'Archive' }));
    await screen.findByText('Archived (1)');
  });

  it('side quests: open until done', async () => {
    await recordAction({
      type: 'quest.create',
      payload: { type: 'side', title: 'Renew passport', stat: 'WIL', due_day: '2026-11-10' },
    });
    await start(<QuestsPage />, '/quests?tab=side');
    expect(screen.getByRole('heading', { name: 'Renew passport' }).closest('li')).toHaveTextContent(
      'Due 10 Nov 2026',
    );
  });
});

describe('Today: This week', () => {
  it('shows weekly and side quests with one "Done" tap', async () => {
    await recordAction({
      type: 'quest.create',
      payload: { type: 'weekly', title: 'Read a paper', stat: 'INT' },
    });
    await recordAction({
      type: 'quest.create',
      payload: { type: 'side', title: 'Call the bank', stat: 'WIL' },
    });
    await start(<ThisWeek />, '/');
    expect(screen.getByRole('heading', { name: /This week/ })).toHaveTextContent('0 / 1 done');
    const card = screen.getByRole('heading', { name: 'Read a paper' }).closest('li') as HTMLElement;
    await userEvent.click(within(card).getByRole('button', { name: 'Done' }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /This week/ })).toHaveTextContent('1 / 1 done'),
    );
    expect(within(card).getByText('Done')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Side quests' })).toBeInTheDocument();
  });
});
