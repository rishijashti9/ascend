import Dexie from 'dexie';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AscendDB } from '@/core/db';
import { getClockOffset, getTimeZoneOverride, resetClock, setNow } from '@/core/time';
import { DevTools } from './DevTools';
import { clearDevClock, restoreDevClock } from './devClock';

const DAY_MS = 86_400_000;
let db: AscendDB;
const reload = vi.fn();

beforeEach(async () => {
  db = new AscendDB(`test-${crypto.randomUUID()}`);
  await db.open();
  reload.mockClear();
});

afterEach(async () => {
  resetClock();
  clearDevClock();
  db.close();
  await Dexie.delete(db.name);
});

async function openPanel() {
  render(<DevTools db={db} reload={reload} />);
  await userEvent.click(screen.getByRole('button', { name: 'Open developer tools' }));
}

describe('DevTools', () => {
  it('jumps forward one day, saves the offset and reloads', async () => {
    await openPanel();
    await userEvent.click(screen.getByRole('button', { name: '+1 day' }));
    expect(getClockOffset()).toBe(DAY_MS);
    expect(reload).toHaveBeenCalledOnce();
    // The offset survives a reload.
    resetClock();
    restoreDevClock();
    expect(getClockOffset()).toBe(DAY_MS);
  });

  it('jumps N days', async () => {
    await openPanel();
    const input = screen.getByRole('spinbutton', { name: 'Days to jump' });
    await userEvent.clear(input);
    await userEvent.type(input, '30');
    await userEvent.click(screen.getByRole('button', { name: 'Jump' }));
    expect(getClockOffset()).toBe(30 * DAY_MS);
  });

  it('shows the app day using the day-start hour (3 AM)', async () => {
    // 02:30 IST on Nov 3 still belongs to Nov 2.
    setNow(Date.UTC(2026, 10, 2, 21, 0));
    render(<DevTools db={db} reload={reload} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open developer tools' }));
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Timezone override' }),
      'Asia/Kolkata',
    );
    expect(getTimeZoneOverride()).toBe('Asia/Kolkata');
    expect(await screen.findByTestId('dev-day')).toHaveTextContent('2026-11-02');
  });

  it('needs two taps to reset all data', async () => {
    await db.meta.put({ id: 'marker', value: 1 });
    await openPanel();
    await userEvent.click(screen.getByRole('button', { name: 'Reset all data' }));
    expect(reload).not.toHaveBeenCalled();
    expect(await db.meta.get('marker')).toBeDefined();
    await userEvent.click(screen.getByRole('button', { name: /Tap again/ }));
    expect(reload).toHaveBeenCalledOnce();
    expect(await Dexie.exists(db.name)).toBe(false);
  });
});
