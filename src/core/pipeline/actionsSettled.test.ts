import { createTestDb, ist } from '@/test/testDb';
import { actionsSettled, recordAction } from './recordAction';

describe('actionsSettled (tests wait for running actions)', () => {
  it('resolves at once when nothing is running', async () => {
    await expect(actionsSettled()).resolves.toBeUndefined();
  });

  it('stays pending while an action runs and resolves once it settles — also when it fails', async () => {
    const t = await createTestDb(ist(2026, 11, 2, 9));
    for (const action of [
      { type: 'day.setLowEnergy', payload: { on: true } }, // succeeds
      { type: 'no.such.action', payload: {} }, // fails
    ]) {
      const running = recordAction(action, { db: t.db }).catch(() => undefined);
      let settled = false;
      const waiting = actionsSettled().then(() => (settled = true));
      await Promise.resolve();
      if (action.type === 'day.setLowEnergy') expect(settled).toBe(false); // still running
      await running;
      await waiting;
      expect(settled).toBe(true);
    }
    await t.cleanup();
  });
});
