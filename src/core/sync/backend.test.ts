import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseBackend, SyncUnavailable, type OutRecord } from './backend';
import { pushBatches } from './engine';

/** A Supabase client whose RPCs answer with the given error. */
const failingClient = (error: { code?: string; message: string }, status = 400) =>
  ({
    rpc: () => Promise.resolve({ data: null, error, status }),
  }) as unknown as SupabaseClient;

const record = (id: string, size = 10): OutRecord => ({
  tbl: 'habits',
  id,
  hlc: `000000000001000-0000-dev`,
  deleted: false,
  data: { id, pad: 'x'.repeat(size) },
});

describe('sync errors are classified (hardening V-02)', () => {
  const reasonOf = async (error: { code?: string; message: string }, status?: number) => {
    try {
      await supabaseBackend(failingClient(error, status)).push([record('a')]);
    } catch (e) {
      return e instanceof SyncUnavailable ? e.reason : 'other';
    }
    return 'no error';
  };

  it('a full cloud copy is "quota", not a generic server error', async () => {
    expect(await reasonOf({ code: '53400', message: 'Cloud storage limit reached' })).toBe('quota');
  });

  it('keeps the existing reasons', async () => {
    expect(await reasonOf({ code: '28000', message: 'Not signed in' })).toBe('auth');
    expect(await reasonOf({ message: 'Failed to fetch' })).toBe('offline');
    expect(await reasonOf({ message: 'x' }, 503)).toBe('paused');
    expect(await reasonOf({ code: '54000', message: 'Request too large' })).toBe('server');
  });
});

describe('push batches stay under the server limits', () => {
  it('splits at 500 records', () => {
    const batches = pushBatches(Array.from({ length: 1201 }, (_, i) => record(`r${i}`)));
    expect(batches.map((b) => b.length)).toEqual([500, 500, 201]);
  });

  it('splits by size, keeping order, and never drops an oversized record', () => {
    const records = [record('a', 600), record('b', 600), record('c', 5000), record('d', 10)];
    const batches = pushBatches(records, 1500);
    expect(batches.map((b) => b.map((r) => r.id))).toEqual([['a', 'b'], ['c'], ['d']]);
  });

  it('no records, no batches', () => {
    expect(pushBatches([])).toEqual([]);
  });
});
