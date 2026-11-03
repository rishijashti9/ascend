import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { db } from '@/core/db/db';
import { clearSubscribers, recordAction } from '@/core/pipeline';
import { MyDataPage } from './MyDataPage';

beforeEach(async () => {
  await db.delete();
  await db.open();
});
afterEach(() => clearSubscribers());

it('shows what is stored, the cloud state and everything sent outside', async () => {
  await recordAction({
    type: 'outbound.record',
    payload: { service: 'gemini', kind: 'ask', chars: 240 },
  });
  render(
    <MemoryRouter>
      <MyDataPage />
    </MemoryRouter>,
  );
  const stored = screen.getByRole('region', { name: 'Stored on this device' });
  expect(await screen.findByText('Profile and settings')).toBeInTheDocument();
  expect(stored).toHaveTextContent('Total');
  expect(screen.getByRole('region', { name: 'In your cloud account' })).toHaveTextContent(
    'Not signed in — nothing is stored in the cloud.',
  );
  expect(await screen.findByText(/1 question to Google Gemini/)).toBeInTheDocument();
  expect(screen.getByText(/240 characters/)).toBeInTheDocument();
});
