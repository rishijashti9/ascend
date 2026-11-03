import type { SupabaseClient } from '@supabase/supabase-js';
import { MemoryCloud } from '@/test/memoryBackend';
import { deleteEverything } from './deleteEverything';

function client(fnError: unknown = null) {
  return {
    functions: { invoke: vi.fn().mockResolvedValue({ error: fnError }) },
    auth: { signOut: vi.fn().mockResolvedValue({}) },
  } as unknown as SupabaseClient & {
    functions: { invoke: ReturnType<typeof vi.fn> };
    auth: { signOut: ReturnType<typeof vi.fn> };
  };
}

describe('delete everything (SPEC 6.7 D)', () => {
  it('final export → cloud → account → device, in that order', async () => {
    const cloud = new MemoryCloud();
    await cloud.backend().push([
      {
        tbl: 'habits',
        id: 'h',
        hlc: `${'1'.padStart(15, '0')}-0000-d`,
        deleted: false,
        data: {},
      },
    ]);
    const c = client();
    const wipe = vi.fn().mockResolvedValue(undefined);
    const r = await deleteEverything({
      exportFinal: async () => 'saved',
      cloud: { backend: cloud.backend(), client: c },
      deleteAccount: true,
      wipeDevice: wipe,
    });
    expect(r).toEqual({ ok: true });
    expect(cloud.size).toBe(0);
    expect(c.functions.invoke).toHaveBeenCalledWith('delete-account', { method: 'POST' });
    expect(c.auth.signOut).toHaveBeenCalled();
    expect(wipe).toHaveBeenCalled();
  });

  it('a cancelled export deletes nothing', async () => {
    const wipe = vi.fn();
    const r = await deleteEverything({
      exportFinal: async () => 'cancelled',
      cloud: null,
      deleteAccount: false,
      wipeDevice: wipe,
    });
    expect(r).toMatchObject({ ok: false, step: 'export' });
    expect(wipe).not.toHaveBeenCalled();
  });

  it('cloud unreachable → nothing local is lost', async () => {
    const cloud = new MemoryCloud();
    cloud.down = 'offline';
    const wipe = vi.fn();
    const r = await deleteEverything({
      exportFinal: async () => 'saved',
      cloud: { backend: cloud.backend(), client: client() },
      deleteAccount: false,
      wipeDevice: wipe,
    });
    expect(r).toMatchObject({ ok: false, step: 'cloud' });
    expect(wipe).not.toHaveBeenCalled();
  });

  it('account deletion failing keeps the device so it can be retried', async () => {
    const wipe = vi.fn();
    const r = await deleteEverything({
      exportFinal: async () => 'saved',
      cloud: { backend: new MemoryCloud().backend(), client: client(new Error('x')) },
      deleteAccount: true,
      wipeDevice: wipe,
    });
    expect(r).toMatchObject({ ok: false, step: 'account' });
    expect(wipe).not.toHaveBeenCalled();
  });
});
