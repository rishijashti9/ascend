import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '@/core/db/db';
import { clearSubscribers } from '@/core/pipeline';
import { startAppState, useAppState } from '@/core/state/app';
import { HealthSettings } from './HealthSettings';

const fake = vi.hoisted(() => ({
  availability: 'available' as 'available' | 'unsupported' | 'not_installed',
  granted: false,
  requestAccess: vi.fn(async () => true),
}));

vi.mock('@/app/health', () => ({
  healthConnect: {
    availability: async () => fake.availability,
    granted: async () => fake.granted,
    requestAccess: async () => {
      const ok = await fake.requestAccess();
      fake.granted = ok;
      return ok;
    },
    openSettings: async () => undefined,
    steps: async () => null,
    sleep: async () => [],
    workouts: async () => [],
  },
}));

function Card() {
  const settings = useAppState((s) => s.settings);
  return settings ? <HealthSettings settings={settings} /> : null;
}

async function renderCard() {
  await startAppState();
  render(<Card />);
}

beforeEach(async () => {
  await db.delete();
  await db.open();
  fake.availability = 'available';
  fake.granted = false;
});
afterEach(() => clearSubscribers());

describe('Health Connect settings', () => {
  it('in a browser it only explains where the numbers come from', async () => {
    fake.availability = 'unsupported';
    await renderCard();
    expect(await screen.findByText(/arrive through sync/)).toBeInTheDocument();
  });

  it('connect asks Health Connect, then switches reading on', async () => {
    await renderCard();
    await userEvent.click(await screen.findByRole('button', { name: 'Connect Health Connect' }));
    await waitFor(async () =>
      expect((await db.settings.get('settings'))?.health_connect_enabled).toBe(true),
    );
    expect(
      await screen.findByRole('switch', { name: /Read steps, sleep and workouts/ }),
    ).toBeInTheDocument();
  });

  it('says so when access is refused', async () => {
    fake.requestAccess.mockResolvedValueOnce(false);
    await renderCard();
    await userEvent.click(await screen.findByRole('button', { name: 'Connect Health Connect' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('didn’t allow all three');
    expect((await db.settings.get('settings'))?.health_connect_enabled).toBe(false);
  });
});
