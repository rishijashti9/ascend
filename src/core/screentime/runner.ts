import type { AscendDB } from '@/core/db/db';
import { logError } from '@/core/errorLog';
import { recordAction } from '@/core/pipeline';
import type { ScreenBridge } from './bridge';
import { checkIntegrity } from './integrity';
import { judgeRecentDays } from './judge';
import { READ_EVERY_MS, readScreenTime } from './reader';
import { startSnapshotWriter } from './snapshot';
import { refreshTrustedTime } from './trustedTime';

/**
 * Screen time while ASCEND is open (tasks 11.6–11.8): read the phone's totals, keep the phone's
 * copy of the rules current, learn the server time, apply waiting changes once a lock has
 * ended, and check nothing that keeps the reminders working was switched off. On open, on
 * coming back to the front, and every 15 minutes. Returns a stop function.
 */
export async function screenTimeTick(bridge: ScreenBridge, db: AscendDB): Promise<void> {
  try {
    await refreshTrustedTime(db);
    await recordAction({ type: 'screen.applyPending', source: 'system', payload: {} }, { db });
    await readScreenTime(bridge, db);
    await checkIntegrity(bridge, db);
    await judgeRecentDays(db);
  } catch (error) {
    logError(error, 'screen.tick');
  }
}

export function startScreenTime(
  bridge: ScreenBridge,
  db: AscendDB,
  onVisible: (listener: () => void) => () => void,
): () => void {
  const stopWriter = startSnapshotWriter(bridge, db);
  void screenTimeTick(bridge, db);
  const timer = setInterval(() => void screenTimeTick(bridge, db), READ_EVERY_MS);
  const stopVisible = onVisible(() => void screenTimeTick(bridge, db));
  return () => {
    stopWriter();
    stopVisible();
    clearInterval(timer);
  };
}
