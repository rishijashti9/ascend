import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SyncChoice } from './SyncChoice';

const backup = vi.hoisted(() => ({ where: null as string | null }));
vi.mock('@/app/localBackup', () => ({ writeLocalBackup: async () => backup.where }));
const runner = vi.hoisted(() => ({ choose: vi.fn(async () => undefined) }));
vi.mock('@/core/state/sync', () => ({ syncRunner: () => runner }));

afterEach(() => vi.clearAllMocks());

describe('Sync choice', () => {
  it('saves a backup first; if that fails, nothing changes', async () => {
    backup.where = null;
    render(<SyncChoice />);
    await userEvent.click(screen.getByRole('button', { name: 'Use my account’s data' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('nothing was changed');
    expect(runner.choose).not.toHaveBeenCalled();

    backup.where = 'Documents/ASCEND/ascend-before-sync-2026-11-03.json';
    await userEvent.click(screen.getByRole('button', { name: 'Merge both' }));
    expect(runner.choose).toHaveBeenCalledWith('merge');
    expect(screen.getByRole('status')).toHaveTextContent(
      'A backup of this device was saved first (Documents/ASCEND/ascend-before-sync-2026-11-03.json).',
    );
  });
});
