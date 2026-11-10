import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { AskEntry } from './AskButton';
import { askScreenFor } from './askContext';

describe('Ask the System from the main screens (Phase 12, UX-1)', () => {
  it('suggests questions that fit the screen you came from', () => {
    expect(askScreenFor('/').name).toBe('Today');
    expect(askScreenFor('/growth/roadmap').suggestions[0]).toMatch(/ROS 2/);
    expect(askScreenFor('/growth/goals/abc').name).toBe('Goals');
    expect(askScreenFor('/me/body').note).toMatch(/never leave this device/);
    expect(askScreenFor('/me/stats').name).toBe('Me');
  });

  it('is an inline button (not floating over the content)', () => {
    render(
      <MemoryRouter initialEntries={['/quests']}>
        <AskEntry />
      </MemoryRouter>,
    );
    const button = screen.getByRole('button', { name: 'Ask the System' });
    expect(button.className).not.toMatch(/\bfixed\b|\babsolute\b/);
  });

  it('opens a bottom sheet that knows the screen; Escape closes it', async () => {
    render(
      <MemoryRouter initialEntries={['/me/body']}>
        <AskEntry />
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
});
