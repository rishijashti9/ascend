import { describe, expect, it } from 'vitest';
import type { ScreenDay } from '@/core/db/types';
import { combineDays, entertainmentSeconds, isEntertainment, topApps } from './apps';
import { observeState, observeWindow, suggestLimit } from './observe';

const none = { added_apps: [], removed_apps: [] };
const ctx = (labels: Record<string, string> = {}, games: string[] = []) => ({
  labels,
  games: new Set(games),
});

function day(apps: Record<string, number>, extra: Partial<ScreenDay> = {}): ScreenDay {
  return {
    id: `phone:${extra.day ?? '2026-11-04'}`,
    created_at: '',
    updated_at: '',
    deleted_at: null,
    schema_version: 1,
    hlc: '1',
    device_id: 'phone',
    day: '2026-11-04',
    apps,
    focus: {},
    labels: {},
    games: [],
    ...extra,
  };
}

describe('entertainment apps', () => {
  it('built-in list by package or by app name, games, and nothing else', () => {
    expect(isEntertainment('com.instagram.android', none, ctx())).toBe(true);
    expect(isEntertainment('ahaflix.unknown', none, ctx({ 'ahaflix.unknown': 'aha' }))).toBe(true);
    expect(isEntertainment('com.supercell.clash', none, ctx({}, ['com.supercell.clash']))).toBe(
      true,
    );
    expect(isEntertainment('com.android.chrome', none, ctx())).toBe(false);
    expect(isEntertainment('org.ros.docs', none, ctx())).toBe(false);
  });

  it('added apps count, removed apps never do', () => {
    const rules = { added_apps: ['com.reddit.frontpage'], removed_apps: ['com.cricbuzz.android'] };
    expect(isEntertainment('com.reddit.frontpage', rules, ctx())).toBe(true);
    expect(isEntertainment('com.cricbuzz.android', rules, ctx())).toBe(false);
  });

  it('adds devices together; YouTube inside focus sessions does not count', () => {
    const t = combineDays([
      day(
        { 'com.google.android.youtube': 3600, 'com.android.chrome': 900 },
        {
          focus: { 'com.google.android.youtube': 1800 },
        },
      ),
      day({ 'com.instagram.android': 600 }, { id: 'tablet:2026-11-04', device_id: 'tablet' }),
    ]);
    expect(entertainmentSeconds(t, none)).toBe(1800 + 600);
    const top = topApps(t, none);
    expect(top.map((a) => [a.pkg, a.seconds])).toEqual([
      ['com.google.android.youtube', 1800],
      ['com.android.chrome', 900],
      ['com.instagram.android', 600],
    ]);
    expect(top[1]?.entertainment).toBe(false);
  });

  it('ignores deleted records', () => {
    const t = combineDays([day({ 'com.instagram.android': 600 }, { deleted_at: 'x' })]);
    expect(entertainmentSeconds(t, none)).toBe(0);
  });
});

describe('observe week and the limit suggestion', () => {
  it('observes 7 days quietly, then is ready once enough days have data', () => {
    expect(observeState(null, '2026-11-04', null, 0)).toEqual({ phase: 'off' });
    expect(observeState('2026-11-04', '2026-11-04', null, 0)).toEqual({
      phase: 'observing',
      day: 1,
      endsOn: '2026-11-11',
    });
    expect(observeState('2026-11-04', '2026-11-10', null, 6)).toMatchObject({ day: 7 });
    expect(observeState('2026-11-04', '2026-11-11', null, 7)).toEqual({ phase: 'ready' });
    expect(observeState('2026-11-04', '2026-11-11', null, 3)).toEqual({
      phase: 'waiting_for_data',
    });
    expect(observeState('2026-11-04', '2026-11-05', 60, 1)).toEqual({ phase: 'set' });
  });

  it('averages the observe week (never today), or the last 7 days when setup waited long', () => {
    expect(observeWindow('2026-11-04', '2026-11-11')).toHaveLength(7);
    expect(observeWindow('2026-11-04', '2026-11-11').at(-1)).toBe('2026-11-10');
    expect(observeWindow('2026-11-04', '2026-12-01')[0]).toBe('2026-11-24');
  });

  it('suggests a realistic step down, rounded to 15 min, never below 15', () => {
    const h = 3600;
    expect(suggestLimit([2 * h, 2 * h, 2.5 * h, 1.5 * h])).toEqual({
      averageMin: 120,
      limitMin: 90,
    });
    expect(suggestLimit([600])).toEqual({ averageMin: 10, limitMin: 15 });
    expect(suggestLimit([5 * h])).toEqual({ averageMin: 300, limitMin: 240 });
    expect(suggestLimit([])).toBeNull();
  });
});
