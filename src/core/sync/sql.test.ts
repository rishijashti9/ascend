// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { incomingWins, sortKey } from './merge';

/**
 * The Supabase migration, run for real in Postgres (PGlite) with a stand-in for Supabase's
 * `auth` schema and roles: Row Level Security, push_records' conflict rules, and the same
 * cases checked against the TypeScript rules in merge.ts.
 */
const MIGRATIONS = join(process.cwd(), 'supabase', 'migrations');
const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';

let pg: PGlite;

async function as(user: string | null) {
  await pg.exec('reset role');
  if (user) {
    await pg.query(`select set_config('request.jwt.claim.sub', $1, false)`, [user]);
    await pg.exec('set role authenticated');
  } else {
    await pg.query(`select set_config('request.jwt.claim.sub', '', false)`);
    await pg.exec('set role anon');
  }
}
const hlc = (ms: number, counter = 0, device = 'dev1') =>
  `${String(ms).padStart(15, '0')}-${counter.toString(36).padStart(4, '0')}-${device}`;
const push = async (records: unknown[]) =>
  (
    await pg.query<{ r: { accepted: number; kept: number } }>('select push_records($1) as r', [
      JSON.stringify(records),
    ])
  ).rows[0]?.r;
const rows = async () =>
  (
    await pg.query<{
      tbl: string;
      id: string;
      hlc: string;
      data: Record<string, unknown>;
      seq: string;
    }>('select tbl, id, hlc, data, seq from sync_records order by seq')
  ).rows;

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(`
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create role anon;
    create role authenticated;
    grant usage on schema public, auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    insert into auth.users values ('${A}'), ('${B}');
  `);
  for (const file of readdirSync(MIGRATIONS).sort()) {
    await pg.exec(readFileSync(join(MIGRATIONS, file), 'utf8'));
  }
}, 180_000); // Postgres starting in WebAssembly is slow when the whole suite runs at once
afterAll(async () => {
  await pg.close();
});
beforeEach(async () => {
  await pg.exec('reset role; delete from sync_records;');
});

describe('Supabase migration (run in Postgres)', () => {
  it('a user only ever sees their own rows; anonymous users can’t read or write', async () => {
    await as(A);
    expect(await push([{ tbl: 'habits', id: 'h1', hlc: hlc(1000), data: { title: 'A' } }])).toEqual(
      { accepted: 1, kept: 0 },
    );
    await as(B);
    await push([{ tbl: 'habits', id: 'h1', hlc: hlc(5000), data: { title: 'B' } }]);
    expect((await rows()).map((r) => r.data.title)).toEqual(['B']);
    await as(A);
    expect((await rows()).map((r) => r.data.title)).toEqual(['A']);
    // No direct writes, even to own rows.
    await expect(pg.exec(`update sync_records set data = '{}'::jsonb`)).rejects.toThrow();
    await expect(
      pg.exec(
        `insert into sync_records (tbl, id, hlc, sort_key, data) values ('habits','x','${hlc(1)}','x','{}')`,
      ),
    ).rejects.toThrow();
    await as(null);
    await expect(rows()).rejects.toThrow();
    await expect(push([])).rejects.toThrow();
  });

  it('last write wins by HLC; a clock in the future is capped at the server time', async () => {
    await as(A);
    const now = Date.now();
    await push([{ tbl: 'habits', id: 'h', hlc: hlc(now - 1000), data: { v: 1 } }]);
    expect(await push([{ tbl: 'habits', id: 'h', hlc: hlc(now - 2000), data: { v: 0 } }])).toEqual({
      accepted: 0,
      kept: 1,
    });
    await push([{ tbl: 'habits', id: 'h', hlc: hlc(now - 500), data: { v: 2 } }]);
    expect((await rows())[0]?.data.v).toBe(2);
    // A phone a year ahead writes "now + 1 year": stored, but ranked at the received time…
    await push([
      { tbl: 'habits', id: 'h', hlc: hlc(now + 31_536_000_000, 0, 'bad'), data: { v: 3 } },
    ]);
    expect((await rows())[0]?.data.v).toBe(3);
    // …so a normal later write still replaces it.
    await new Promise((r) => setTimeout(r, 5));
    await push([{ tbl: 'habits', id: 'h', hlc: hlc(Date.now() + 2), data: { v: 4 } }]);
    expect((await rows())[0]?.data.v).toBe(4);
  });

  it('xp events are append-only; a completion beats a rollover’s missed; days follow the low-energy choice', async () => {
    await as(A);
    await push([{ tbl: 'xp_events', id: 'award:i1:0', hlc: hlc(1000), data: { amount: 25 } }]);
    expect(
      await push([{ tbl: 'xp_events', id: 'award:i1:0', hlc: hlc(9000), data: { amount: 99 } }]),
    ).toEqual({ accepted: 0, kept: 1 });

    await push([
      { tbl: 'quest_instances', id: 'q:d1', hlc: hlc(9000, 0, 'b'), data: { status: 'missed' } },
    ]);
    await push([
      { tbl: 'quest_instances', id: 'q:d1', hlc: hlc(5000, 0, 'a'), data: { status: 'done_full' } },
    ]);
    expect((await rows()).find((r) => r.id === 'q:d1')?.data.status).toBe('done_full');
    expect(
      await push([
        { tbl: 'quest_instances', id: 'q:d1', hlc: hlc(9999), data: { status: 'missed' } },
      ]),
    ).toEqual({ accepted: 0, kept: 1 });

    await push([
      {
        tbl: 'days',
        id: 'd1',
        hlc: hlc(1000),
        data: { low_energy: true, low_energy_set_at: '2026-11-02T08:00:00Z' },
      },
    ]);
    // A later recompute on another device (newer hlc) without that choice doesn't undo it.
    await push([
      {
        tbl: 'days',
        id: 'd1',
        hlc: hlc(8000),
        data: { low_energy: false, low_energy_set_at: null },
      },
    ]);
    expect((await rows()).find((r) => r.id === 'd1')?.data.low_energy).toBe(true);
  });

  it('every accepted write gets a higher seq (pull cursor); reset clears only my cloud copy', async () => {
    await as(A);
    await push([
      { tbl: 'habits', id: 'a', hlc: hlc(1), data: {} },
      { tbl: 'habits', id: 'b', hlc: hlc(1), data: {} },
    ]);
    const before = (await rows()).map((r) => Number(r.seq));
    await push([{ tbl: 'habits', id: 'a', hlc: hlc(2), data: {} }]);
    const after = await rows();
    expect(Number(after.at(-1)?.seq)).toBeGreaterThan(Math.max(...before));
    expect(after.at(-1)?.id).toBe('a');
    await as(B);
    await push([{ tbl: 'habits', id: 'mine', hlc: hlc(1), data: {} }]);
    await as(A);
    await pg.query('select reset_my_cloud_data()');
    expect(await rows()).toEqual([]);
    await as(B);
    expect((await rows()).map((r) => r.id)).toEqual(['mine']);
  });

  it('accepts the Phase 8 tables (learning events, summaries, compactions)', async () => {
    await as(A);
    for (const tbl of ['learning_events', 'summaries', 'compactions']) {
      expect(
        await push([{ tbl, id: `${tbl}-1`, hlc: hlc(5), data: { id: `${tbl}-1` } }]),
      ).toMatchObject({
        accepted: 1,
      });
    }
  });

  it('accepts the Phase 11 tables; server version 3; server_time works without an account', async () => {
    await as(A);
    for (const tbl of ['screen_days', 'screen_rules', 'screen_locks', 'screen_events']) {
      expect(
        await push([{ tbl, id: `${tbl}-1`, hlc: hlc(5), data: { id: `${tbl}-1` } }]),
      ).toMatchObject({ accepted: 1 });
    }
    expect((await pg.query<{ v: number }>('select sync_server_version() as v')).rows[0]?.v).toBe(3);
    await as(null);
    const t = (await pg.query<{ t: Date }>('select server_time() as t')).rows[0]?.t;
    expect(t).toBeInstanceOf(Date);
  });

  it('my_cloud_usage counts only my live records', async () => {
    await as(A);
    await push([
      { tbl: 'habits', id: 'u1', hlc: hlc(1), data: { id: 'u1', title: 'x' } },
      { tbl: 'habits', id: 'u2', hlc: hlc(1), deleted: true, data: { id: 'u2' } },
    ]);
    await as(B);
    await push([{ tbl: 'habits', id: 'v1', hlc: hlc(1), data: { id: 'v1' } }]);
    await as(A);
    const r = (
      await pg.query<{ u: { records: number; bytes: number } }>('select my_cloud_usage() as u')
    ).rows[0]?.u;
    expect(r?.records).toBe(1);
    expect(r?.bytes).toBeGreaterThan(0);
  });

  it('compact_my_records removes my old detail after my compaction synced, nothing else', async () => {
    await as(A);
    const rec = (tbl: string, id: string, data: Record<string, unknown>) => ({
      tbl,
      id,
      hlc: hlc(2),
      data: { id, ...data },
    });
    await expect(pg.query(`select compact_my_records('2025-02-01')`)).rejects.toThrow(/not synced/);
    await push([
      rec('xp_events', 'k-old', { day: '2025-01-10' }),
      rec('xp_events', 'k-new', { day: '2025-02-10' }),
      rec('quest_instances', 'h:2025-01-10', { day: '2025-01-10' }),
      rec('quest_instances', 'recovery:2025-01-11', { day: '2025-01-11' }),
      rec('summaries', 'summary:month:2025-01', {}),
      rec('compactions', 'compaction:2025-02-01', { cutoff_day: '2025-02-01' }),
    ]);
    await as(B);
    await push([rec('xp_events', 'k-b', { day: '2025-01-10' })]);
    await as(A);
    const n = (await pg.query<{ n: number }>(`select compact_my_records('2025-02-01') as n`))
      .rows[0]?.n;
    expect(n).toBe(2);
    const left = (await rows()).map((r) => r.id).sort();
    expect(left).toEqual([
      'compaction:2025-02-01',
      'k-new',
      'recovery:2025-01-11',
      'summary:month:2025-01',
    ]);
    await expect(pg.query(`select compact_my_records('2025-02-15')`)).rejects.toThrow(/first day/);
  });

  it('ask_take counts questions per user per day, stops at the limit, and only the server may call it', async () => {
    await pg.exec('reset role');
    const take = async () =>
      (await pg.query<{ n: number }>(`select ask_take('${A}', 2) as n`)).rows[0]?.n;
    expect([await take(), await take(), await take()]).toEqual([1, 2, -1]);
    await as(A);
    await expect(pg.query(`select ask_take('${A}', 99)`)).rejects.toThrow();
    await expect(pg.query('select * from ask_usage')).rejects.toThrow(/permission denied/);
  });

  it('rejects unknown tables, bad clocks and oversized batches', async () => {
    await as(A);
    await expect(push([{ tbl: 'photos', id: 'p', hlc: hlc(1), data: {} }])).rejects.toThrow();
    await expect(push([{ tbl: 'habits', id: 'p', hlc: 'yesterday', data: {} }])).rejects.toThrow();
    await expect(
      push(
        Array.from({ length: 501 }, (_, i) => ({
          tbl: 'habits',
          id: `x${i}`,
          hlc: hlc(1),
          data: {},
        })),
      ),
    ).rejects.toThrow();
  });
});

describe('sign-ups are closed except for the allow-list (hardening V-01)', () => {
  const C = '33333333-3333-3333-3333-333333333333';
  afterEach(async () => {
    await pg.exec(`reset role; delete from auth.users where id = '${C}';
      delete from private.signup_allowlist;`);
  });

  it('a new account is refused while the allow-list is empty', async () => {
    await pg.exec('reset role');
    await expect(
      pg.query(`insert into auth.users (id, email) values ('${C}', 'stranger@example.com')`),
    ).rejects.toThrow(/Sign-ups are closed/);
  });

  it('an allow-listed email may sign up, matched case-insensitively', async () => {
    await pg.exec(
      `reset role; insert into private.signup_allowlist (email) values ('me@example.com')`,
    );
    await pg.query(`insert into auth.users (id, email) values ('${C}', 'Me@Example.com')`);
    const n = await pg.query<{ n: number }>(
      `select count(*)::int as n from auth.users where id = '${C}'`,
    );
    expect(n.rows[0]?.n).toBe(1);
  });

  it('an account without an email (e.g. phone) is refused too', async () => {
    await pg.exec('reset role');
    await expect(pg.query(`insert into auth.users (id) values ('${C}')`)).rejects.toThrow(
      /Sign-ups are closed/,
    );
  });

  it('existing accounts keep working: updates (e.g. last sign-in) are not blocked', async () => {
    await pg.exec('reset role');
    await pg.query(`update auth.users set email = 'a@example.com' where id = '${A}'`);
  });

  it('app users can neither read nor change the allow-list', async () => {
    for (const who of [A, null]) {
      await as(who);
      await expect(pg.query('select * from private.signup_allowlist')).rejects.toThrow(
        /permission denied/,
      );
      await expect(
        pg.query(`insert into private.signup_allowlist (email) values ('x@example.com')`),
      ).rejects.toThrow(/permission denied/);
    }
  });
});

describe('the TypeScript rules match the SQL rules', () => {
  const cases: [string, Record<string, unknown>, string, Record<string, unknown>, string][] = [
    ['habits', {}, hlc(1), {}, hlc(2)],
    ['habits', {}, hlc(2), {}, hlc(1)],
    ['habits', {}, hlc(2), {}, hlc(2)],
    ['xp_events', {}, hlc(1), {}, hlc(2)],
    ['quest_instances', { status: 'missed' }, hlc(9), { status: 'done_min' }, hlc(1)],
    ['quest_instances', { status: 'done_late' }, hlc(1), { status: 'missed' }, hlc(9)],
    ['quest_instances', { status: 'done_full' }, hlc(1), { status: 'pending' }, hlc(9)],
    [
      'quest_instances',
      { status: 'done_full', award_revision: 0 },
      hlc(1),
      { status: 'pending', award_revision: 1 },
      hlc(0),
    ],
    [
      'quest_instances',
      { status: 'pending', award_revision: 2 },
      hlc(1),
      { status: 'done_full', award_revision: 1 },
      hlc(9),
    ],
    ['quest_instances', { status: 'done_min' }, hlc(9), { status: 'done_full' }, hlc(1)],
    ['quest_instances', { status: 'done_full' }, hlc(1), { status: 'done_late' }, hlc(9)],
    ['quest_instances', { status: 'pending' }, hlc(1), { status: 'missed' }, hlc(9)],
    ['quest_instances', { status: 'missed' }, hlc(9), { status: 'pending' }, hlc(1)],
    ['days', { low_energy_set_at: 'b' }, hlc(1), { low_energy_set_at: 'a' }, hlc(9)],
    ['days', { low_energy_set_at: null }, hlc(1), { low_energy_set_at: 'a' }, hlc(0)],
    ['days', { low_energy_set_at: 'a' }, hlc(1), { low_energy_set_at: 'a' }, hlc(2)],
    ['screen_locks', { end_at: '2026-11-16' }, hlc(1), { end_at: '2026-11-09' }, hlc(9)],
    ['screen_locks', { end_at: '2026-11-09' }, hlc(9), { end_at: '2026-11-16' }, hlc(1)],
    ['screen_locks', { end_at: '2026-11-09' }, hlc(1), { end_at: '2026-11-09' }, hlc(2)],
    ['screen_rules', { limit_min: 30 }, hlc(1), { limit_min: 90 }, hlc(2)],
  ];
  it.each(cases)('%s', async (tbl, oldData, oldSort, newData, newSort) => {
    const sql = (
      await pg.query<{ w: boolean }>('select sync_incoming_wins($1, $2, $3, $4, $5) as w', [
        tbl,
        JSON.stringify(oldData),
        oldSort,
        JSON.stringify(newData),
        newSort,
      ])
    ).rows[0]?.w;
    expect(incomingWins(tbl, oldData, oldSort, newData, newSort)).toBe(sql);
  });

  it('sort keys match', async () => {
    for (const [h, received] of [
      [hlc(5000, 3, 'x'), 9000],
      [hlc(9000, 3, 'x'), 5000],
    ] as const) {
      const sql = (
        await pg.query<{ k: string }>('select sync_sort_key($1, $2) as k', [h, received])
      ).rows[0]?.k;
      expect(sortKey(h, received)).toBe(sql);
    }
  });
});
