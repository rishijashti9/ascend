import Dexie from 'dexie';
import { AscendDB } from '@/core/db/db';
import { recordAction, type Action } from '@/core/pipeline';
import { resetClock, setNow, setTimeZoneOverride } from '@/core/time';

/** Instant for a wall time in Asia/Kolkata (UTC+5:30). */
export function ist(y: number, mo: number, d: number, h: number, mi = 0): number {
  return Date.UTC(y, mo - 1, d, h, mi) - 5.5 * 3_600_000;
}

/**
 * A fresh database plus helpers, with the clock fixed in Asia/Kolkata.
 * Default time: Monday 2026-11-02, 10:00 IST.
 */
export async function createTestDb(start = ist(2026, 11, 2, 10)) {
  const db = new AscendDB(`test-${crypto.randomUUID()}`);
  await db.open();
  setTimeZoneOverride('Asia/Kolkata');
  setNow(start);
  return {
    db,
    run: <R = unknown>(action: Action) => recordAction<R>(action, { db }),
    async cleanup() {
      resetClock();
      db.close();
      await Dexie.delete(db.name);
    },
  };
}
