import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { AskButton } from './AskButton';
import { askScreenFor, showsAskButton } from './askContext';

describe('Ask the System from anywhere (Phase 12)', () => {
  it('suggests questions that fit the screen you came from', () => {
    expect(askScreenFor('/').name).toBe('Today');
    expect(askScreenFor('/growth/roadmap').suggestions[0]).toMatch(/ROS 2/);
    expect(askScreenFor('/growth/goals/abc').name).toBe('Goals');
    expect(askScreenFor('/me/body').note).toMatch(/never leave this device/);
    expect(askScreenFor('/me/stats').name).toBe('Me');
  });

  it('shows on the main screens only', () => {
    for (const p of ['/', '/quests', '/focus', '/growth/skills', '/me/reviews'])
      expect(showsAskButton(p), p).toBe(true);
    for (const p of ['/settings', '/my-data', '/ask']) expect(showsAskButton(p), p).toBe(false);
  });

  it('opens a bottom sheet that knows the screen; Escape closes it', async () => {
    render(
      <MemoryRouter initialEntries={['/me/body']}>
        <AskButton />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Ask the System' }));
    const sheet = screen.getByRole('dialog', { name: 'Ask the System' });
    expect(sheet).toHaveTextContent('you’re on Body');
    expect(sheet).toHaveTextContent('General health answers only');
    expect(screen.getByRole('button', { name: 'How much sleep do adults need?' })).toBeVisible();
    expect(screen.getByLabelText('Your question')).toBeVisible();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('isn’t there on Settings', () => {
    render(
      <MemoryRouter initialEntries={['/settings']}>
        <AskButton />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('button', { name: 'Ask the System' })).toBeNull();
  });
});
