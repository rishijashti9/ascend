import type { SupabaseClient } from '@supabase/supabase-js';
import { MemoryCloud } from '@/test/memoryBackend';
import {
  FRESH_SIGN_IN_SECONDS,
  isFreshSignIn,
  signedInAt,
} from '../../../supabase/functions/delete-account/fresh';
import { deleteEverything } from './deleteEverything';

const nowSec = () => Math.floor(Date.now() / 1000);

/** A JWT-shaped access token (unsigned: only the payload matters for these checks). */
function token(claims: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64({ alg: 'HS256' })}.${b64(claims)}.sig`;
}
const signedInSecondsAgo = (s: number) =>
  token({ sub: 'u', amr: [{ method: 'oauth', timestamp: nowSec() - s }] });

function client(fnError: unknown = null, accessToken = signedInSecondsAgo(60)) {
  return {
    functions: { invoke: vi.fn().mockResolvedValue({ error: fnError }) },
    auth: {
      signOut: vi.fn().mockResolvedValue({}),
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: accessToken } } }),
    },
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

  it('deleting the account needs a recent sign-in, checked before ANYTHING is deleted (V-11)', async () => {
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
    const c = client(null, signedInSecondsAgo(FRESH_SIGN_IN_SECONDS + 60));
    const wipe = vi.fn();
    const r = await deleteEverything({
      exportFinal: async () => 'saved',
      cloud: { backend: cloud.backend(), client: c },
      deleteAccount: true,
      wipeDevice: wipe,
    });
    expect(r).toMatchObject({ ok: false, step: 'reauth' });
    expect(cloud.size).toBe(1); // the cloud copy is untouched
    expect(c.functions.invoke).not.toHaveBeenCalled();
    expect(wipe).not.toHaveBeenCalled();
  });

  it('a stale sign-in still allows deleting just the data (no account deletion)', async () => {
    const wipe = vi.fn().mockResolvedValue(undefined);
    const r = await deleteEverything({
      exportFinal: async () => 'saved',
      cloud: {
        backend: new MemoryCloud().backend(),
        client: client(null, signedInSecondsAgo(86_400)),
      },
      deleteAccount: false,
      wipeDevice: wipe,
    });
    expect(r).toEqual({ ok: true });
  });

  it('if the server still says "sign in again", the device is kept', async () => {
    const wipe = vi.fn();
    const refused = Object.assign(new Error('403'), {
      context: new Response('{}', { status: 403 }),
    });
    const r = await deleteEverything({
      exportFinal: async () => 'saved',
      cloud: { backend: new MemoryCloud().backend(), client: client(refused) },
      deleteAccount: true,
      wipeDevice: wipe,
    });
    expect(r).toMatchObject({ ok: false, step: 'reauth' });
    expect(wipe).not.toHaveBeenCalled();
  });
});

describe('fresh sign-in check (shared with the delete-account Edge Function)', () => {
  it('reads the latest authentication time from amr', () => {
    const t = token({
      amr: [
        { method: 'password', timestamp: 100 },
        { method: 'otp', timestamp: 250 },
      ],
    });
    expect(signedInAt(t)).toBe(250);
  });

  it('recent → fresh; old, missing, future or garbage → not fresh', () => {
    expect(isFreshSignIn(signedInSecondsAgo(30), nowSec())).toBe(true);
    expect(isFreshSignIn(signedInSecondsAgo(FRESH_SIGN_IN_SECONDS - 5), nowSec())).toBe(true);
    expect(isFreshSignIn(signedInSecondsAgo(FRESH_SIGN_IN_SECONDS + 5), nowSec())).toBe(false);
    expect(isFreshSignIn(signedInSecondsAgo(-3600), nowSec())).toBe(false); // in the future
    expect(isFreshSignIn(token({ sub: 'u' }), nowSec())).toBe(false); // no amr
    expect(isFreshSignIn(token({ amr: [{ method: 'otp' }] }), nowSec())).toBe(false);
    expect(isFreshSignIn('not-a-jwt', nowSec())).toBe(false);
    expect(isFreshSignIn('a.%%%.c', nowSec())).toBe(false);
    expect(isFreshSignIn('', nowSec())).toBe(false);
  });
});
