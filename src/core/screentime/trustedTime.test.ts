import type { SupabaseClient } from '@supabase/supabase-js';
import Dexie from 'dexie';
import { AscendDB } from '@/core/db/db';
import { recordAction } from '@/core/pipeline';
import { setSupabase } from '@/core/sync/client';
import { lockActive } from './lock';
import { refreshTrustedTime } from './serverTime';
import { trustedMs } from './trustedTime';

let db: AscendDB;
beforeEach(async () => {
  db = new AscendDB(`trusted-${crypto.randomUUID()}`);
  await db.open();
});
afterEach(async () => {
  setSupabase(undefined);
  db.close();
  await Dexie.delete(db.name);
});

const fakeServer = (iso: string | null) =>
  ({
    rpc: async () => (iso ? { data: iso, error: null } : { data: null, error: { code: 'x' } }),
  }) as unknown as SupabaseClient;

describe('trusted time for locks', () => {
  it('remembers the server time; it only moves forward', async () => {
    expect(await trustedMs(db)).toBeNull();
    setSupabase(fakeServer('2026-11-10T00:00:00.000Z'));
    expect(await refreshTrustedTime(db)).toBe(Date.parse('2026-11-10T00:00:00.000Z'));
    // An older answer (or a replayed one) never moves it back.
    await recordAction(
      {
        type: 'screen.noteServerTime',
        source: 'system',
        payload: { ms: Date.parse('2026-11-01') },
      },
      { db },
    );
    expect(await trustedMs(db)).toBe(Date.parse('2026-11-10T00:00:00.000Z'));
  });

  it('offline or not set up: nothing changes, and a lock stays on', async () => {
    setSupabase(null);
    expect(await refreshTrustedTime(db)).toBeNull();
    setSupabase(fakeServer(null));
    expect(await refreshTrustedTime(db)).toBeNull();
    const lock = { end_at: '2026-11-05T00:00:00.000Z', deleted_at: null };
    // The phone's clock says the lock ended long ago — it doesn't matter.
    expect(lockActive(lock, await trustedMs(db))).toBe(true);
  });

  it('a lock ends once the server time passes its end', async () => {
    const lock = { end_at: '2026-11-05T00:00:00.000Z', deleted_at: null };
    setSupabase(fakeServer('2026-11-04T23:59:00.000Z'));
    expect(lockActive(lock, await refreshTrustedTime(db))).toBe(true);
    setSupabase(fakeServer('2026-11-05T00:00:01.000Z'));
    expect(lockActive(lock, await refreshTrustedTime(db))).toBe(false);
  });
});
