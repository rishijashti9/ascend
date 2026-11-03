import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { db } from '@/core/db/db';
import { clearSubscribers } from '@/core/pipeline';
import { startAppState } from '@/core/state/app';
import { AskPage } from './AskPage';

beforeEach(async () => {
  await db.delete();
  await db.open();
  await startAppState();
});
afterEach(() => clearSubscribers());

const ask = async (q: string) => {
  const box = screen.getByRole('textbox', { name: 'Your question' });
  await userEvent.clear(box);
  await userEvent.type(box, q);
  await userEvent.click(screen.getByRole('button', { name: 'Ask' }));
};

it('switched off: the Growth Compass answers; off-topic is declined; crisis shows the helpline', async () => {
  render(
    <MemoryRouter>
      <AskPage />
    </MemoryRouter>,
  );
  expect(screen.getByRole('region', { name: 'Switched off' })).toBeInTheDocument();
  expect(screen.getByText(/may use them to improve its products/)).toBeInTheDocument();

  await ask('How do I prepare for IELTS?');
  const compass = await screen.findByRole('region', { name: 'Growth Compass' });
  expect(compass).toHaveTextContent('Ask the System is switched off');
  expect(compass).toHaveTextContent('IELTS Academic');

  await ask('Who won the cricket match?');
  expect(await screen.findByRole('status')).toHaveTextContent(/only help with career and health/);

  await ask('I want to end my life');
  const safety = await screen.findByRole('region', { name: 'Please read' });
  expect(safety).toHaveTextContent(/talk to someone right now/);
  expect(await db.meta.get('outbound_log')).toBeUndefined(); // nothing was ever sent
}, 30_000);
