import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '@/core/db/db';
import { resetClock, setNow, setTimeZoneOverride } from '@/core/time';
import { ist } from '@/test/testDb';
import { OnboardingPage } from './OnboardingPage';

beforeEach(async () => {
  await db.delete();
  await db.open();
  setTimeZoneOverride('Asia/Kolkata');
  setNow(ist(2026, 11, 2, 10));
});
afterEach(() => resetClock());

const next = () => userEvent.click(screen.getByRole('button', { name: 'Next' }));

describe('OnboardingPage', () => {
  it('can be finished by confirming the pre-filled answers', async () => {
    render(<OnboardingPage />);
    expect(screen.getByRole('heading', { name: 'Welcome' })).toBeInTheDocument();
    for (let i = 0; i < 3; i++) await next();
    // Four steps: the Dream step is the last one (no theme step — ELEVATE is applied for you).
    expect(screen.getByRole('heading', { name: 'Dream & Main Quests' })).toBeInTheDocument();
    expect(screen.getByText('Step 4 of 4')).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup', { name: 'Theme' })).not.toBeInTheDocument();
    // Before 6 PM there is no "start tomorrow" question.
    expect(screen.queryByText('Start today or tomorrow?')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Begin' }));
    await waitFor(async () =>
      expect((await db.profile.get('profile'))?.start_day).toBe('2026-11-02'),
    );
    expect(await db.habits.count()).toBe(8);
    expect((await db.settings.get('settings'))?.ui_theme).toBe('elevate');
  });

  it('allows at most 3 core quests', async () => {
    render(<OnboardingPage />);
    await next();
    await next();
    const cores = screen.getAllByRole('button', { name: 'Core' });
    const pressed = cores.filter((b) => b.getAttribute('aria-pressed') === 'true');
    expect(pressed).toHaveLength(3);
    const free = cores.filter((b) => b.getAttribute('aria-pressed') === 'false');
    expect(free.every((b) => (b as HTMLButtonElement).disabled)).toBe(true);
    await userEvent.click(pressed[0] as HTMLElement);
    expect(free.some((b) => !(b as HTMLButtonElement).disabled)).toBe(true);
  });

  it('after 6 PM asks "Start today or tomorrow?"', async () => {
    setNow(ist(2026, 11, 2, 20));
    render(<OnboardingPage />);
    for (let i = 0; i < 3; i++) await next();
    expect(screen.getByText('Start today or tomorrow?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: /Start tomorrow/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Begin' }));
    await waitFor(async () =>
      expect((await db.profile.get('profile'))?.start_day).toBe('2026-11-03'),
    );
  });

  it('Next is blocked until the step is valid', async () => {
    render(<OnboardingPage />);
    await userEvent.clear(screen.getByLabelText('What should the System call you?'));
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Enter your name');
  });
});
