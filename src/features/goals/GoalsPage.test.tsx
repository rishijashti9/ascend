import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { db } from '@/core/db/db';
import { clearSubscribers } from '@/core/pipeline';
import { startGoals } from '@/core/state/goals';
import { resetClock, setNow, setTimeZoneOverride } from '@/core/time';
import { ist } from '@/test/testDb';
import { GoalsPage } from './GoalsPage';
import { MainQuestPage } from './MainQuestPage';

beforeEach(async () => {
  await db.delete();
  await db.open();
  setTimeZoneOverride('Asia/Kolkata');
  setNow(ist(2026, 11, 2, 10));
  await startGoals();
  const router = createMemoryRouter(
    [
      { path: '/goals', element: <GoalsPage /> },
      { path: '/goals/:id', element: <MainQuestPage /> },
    ],
    { initialEntries: ['/goals'] },
  );
  render(<RouterProvider router={router} />);
});
afterEach(() => {
  clearSubscribers();
  resetClock();
});

async function save(form: HTMLElement, name: string | RegExp) {
  const button = within(form).getByRole('button', { name });
  await waitFor(() => expect(button).toBeEnabled());
  await userEvent.click(button);
}

async function createDreamAndQuest() {
  await userEvent.click(screen.getByRole('button', { name: 'New dream' }));
  const dreamForm = screen.getByRole('form', { name: 'New dream' });
  await userEvent.type(within(dreamForm).getByLabelText('Dream'), 'Robotics engineer');
  await userEvent.type(within(dreamForm).getByLabelText('Why it matters to me'), 'Build humanoids');
  await save(dreamForm, 'Add dream');
  await screen.findByRole('heading', { name: /Robotics engineer/ });

  await userEvent.click(screen.getByRole('button', { name: 'Main quest' }));
  const questForm = screen.getByRole('form', { name: 'New main quest' });
  await userEvent.type(within(questForm).getByLabelText('Main quest'), 'MS in Germany');
  await userEvent.type(within(questForm).getByLabelText('Deadline (optional)'), '2027-10-01');
  await userEvent.type(within(questForm).getByLabelText('Why this matters to me'), 'Research labs');
  await save(questForm, 'Add main quest');
  // A new main quest opens the Goal Planner on its page (SPEC 6.3); close it and go back.
  await userEvent.click(await screen.findByRole('button', { name: 'Close planner' }));
  await userEvent.click(screen.getByRole('link', { name: 'Goals' }));
  return screen.findByRole('link', { name: /MS in Germany/ });
}

describe('Goals screens', () => {
  it('shows a friendly empty state', () => {
    expect(screen.getByText(/No dream yet/)).toBeInTheDocument();
  });

  it('creates a dream with its why, then a main quest with a deadline (the planner opens)', async () => {
    const link = await createDreamAndQuest();
    expect(screen.getByText('“Build humanoids”')).toBeInTheDocument();
    expect(link).toHaveTextContent('0 of 0 milestones · by 1 Oct 2027');
  });

  it('main quest page: why, milestones, and progress when a milestone is marked done', async () => {
    await userEvent.click(await createDreamAndQuest());
    expect(
      await screen.findByRole('heading', { name: /MS in Germany/, level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Why this matters' })).toHaveTextContent(
      'Research labs',
    );

    for (const [title, size] of [
      ['IELTS 7.5', 'Small'],
      ['Applications sent', 'Large'],
    ] as const) {
      // The form closes just after the new milestone appears; wait for the button to return.
      await userEvent.click(await screen.findByRole('button', { name: 'Milestone' }));
      const form = screen.getByRole('form', { name: 'New milestone' });
      await userEvent.type(within(form).getByLabelText('Milestone'), title);
      await userEvent.selectOptions(within(form).getByLabelText('Size'), size);
      await save(form, 'Add milestone');
      await screen.findByRole('heading', { name: title });
    }

    const ielts = screen.getByRole('heading', { name: 'IELTS 7.5' }).closest('li') as HTMLElement;
    await userEvent.click(within(ielts).getByRole('button', { name: 'Mark done' }));
    await userEvent.click(within(ielts).getByRole('button', { name: 'Yes, it’s done' }));
    // Small (1) of Small + Large (1 + 3) = 25%.
    await waitFor(() =>
      expect(screen.getByRole('progressbar', { name: 'MS in Germany progress' })).toHaveAttribute(
        'aria-valuenow',
        '25',
      ),
    );
  }, 15_000); // lots of typing: slow when the whole suite runs in parallel

  it('archive and restore a dream (nothing is deleted)', async () => {
    await createDreamAndQuest();
    await userEvent.click(screen.getByRole('button', { name: 'Manage Robotics engineer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Archive' }));
    await screen.findByText('Archived dreams (1)');
    await userEvent.click(screen.getByText('Archived dreams (1)'));
    await userEvent.click(screen.getByRole('button', { name: 'Manage Robotics engineer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Restore' }));
    await waitFor(() => expect(screen.queryByText(/Archived dreams/)).not.toBeInTheDocument());
    expect(await db.dreams.count()).toBe(1);
  });
});
