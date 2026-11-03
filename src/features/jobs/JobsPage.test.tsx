import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { secondaryNav } from '@/app/navigation';
import { db } from '@/core/db/db';
import { clearSubscribers, recordAction } from '@/core/pipeline';
import { startAppState } from '@/core/state/app';
import { startJobs } from '@/core/state/jobs';
import { startToday } from '@/core/state/today';
import { resetClock, setNow, setTimeZoneOverride } from '@/core/time';
import { ist } from '@/test/testDb';
import { JobsPage } from './JobsPage';

async function setup(jobsOn: boolean) {
  await recordAction({ type: 'settings.update', payload: { jobs_enabled: jobsOn } });
  await startAppState();
  await startToday();
  await startJobs();
  render(
    <MemoryRouter>
      <JobsPage />
    </MemoryRouter>,
  );
}

const editButton = (name: string) =>
  screen.getAllByRole('button', { name: `Edit ${name}` })[0] as HTMLElement;

beforeEach(async () => {
  await db.delete();
  await db.open();
  setTimeZoneOverride('Asia/Kolkata');
  setNow(ist(2026, 11, 2, 11));
});
afterEach(() => {
  clearSubscribers();
  resetClock();
});

describe('Jobs screen', () => {
  it('stays hidden until switched on in Settings', async () => {
    await setup(false);
    expect(await screen.findByText(/job tracker is switched off/)).toBeInTheDocument();
    expect(secondaryNav({ jobs_enabled: false }).map((i) => i.label)).not.toContain('Jobs');
    expect(secondaryNav({ jobs_enabled: true }).map((i) => i.label)).toContain('Jobs');
  });

  it('adds an application, shows it with stats, and moves it along', async () => {
    await setup(true);
    await userEvent.click(await screen.findByRole('button', { name: 'Add application' }));
    const form = screen.getByRole('form', { name: 'New application' });
    await userEvent.type(within(form).getByLabelText('Company'), 'Agile Robots');
    await userEvent.type(within(form).getByLabelText('Role'), 'Robotics intern');
    await userEvent.type(within(form).getByLabelText('Source (optional)'), 'LinkedIn');
    await userEvent.click(within(form).getByRole('button', { name: 'Add application' }));

    const list = await screen.findByRole('region', { name: 'Applied (list)' });
    const card = within(list).getByRole('article', { name: 'Agile Robots, Robotics intern' });
    expect(card).toHaveTextContent('LinkedIn');
    expect(card).toHaveTextContent('Follow up');
    expect(screen.getByRole('region', { name: 'Job search stats' })).toHaveTextContent(
      'Applications1',
    );
    expect(await db.xp_events.count()).toBe(1);

    await userEvent.selectOptions(within(card).getByLabelText('Stage'), 'Interview');
    expect(await screen.findByRole('region', { name: 'Interview (list)' })).toHaveTextContent(
      'Agile Robots',
    );
    await waitFor(async () => expect(await db.xp_events.count()).toBe(2));
  });

  it('edits and deletes an application', async () => {
    await recordAction({ type: 'job.create', payload: { company: 'NEURA', role: 'ML engineer' } });
    await setup(true);
    await screen.findAllByRole('button', { name: 'Edit NEURA' });
    await userEvent.click(editButton('NEURA'));
    const form = screen.getByRole('form', { name: 'Edit NEURA' });
    await userEvent.type(within(form).getByLabelText('Salary range (optional)'), '€50k');
    await userEvent.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(async () =>
      expect((await db.job_applications.toArray())[0]?.salary_range).toBe('€50k'),
    );
    // Wait for the list to show the saved value before opening the form again.
    await screen.findAllByText(/€50k/);
    await userEvent.click(editButton('NEURA'));
    const again = await screen.findByRole('form', { name: 'Edit NEURA' });
    await userEvent.click(within(again).getByRole('button', { name: /^Delete/ }));
    await userEvent.click(within(again).getByRole('button', { name: 'Delete for good' }));
    expect(await screen.findByText(/No applications yet/)).toBeInTheDocument();
  });
});
