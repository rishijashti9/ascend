import { pathFromLink } from '@/app/deepLink';
import type { QuestInstance } from '@/core/db/types';
import { processPending } from '@/core/pending/queue';
import { ensureInstancesForDay, newBase } from '@/core/pipeline';
import { habitFieldsOf, STARTER_HABITS } from '@/data/starter';
import { setNow } from '@/core/time';
import { createTestDb, ist } from '@/test/testDb';
import type { PendingTap, WidgetBridge } from './bridge';
import { buildSnapshot, widgetPalette } from './snapshot';

const D = '2026-11-02';

function inst(over: Partial<QuestInstance>): QuestInstance {
  return {
    ...newBase('x'),
    source_type: 'habit',
    source_id: 'h',
    day: D,
    status: 'pending',
    title_snapshot: 'Quest',
    stat_snapshot: 'INT',
    difficulty_snapshot: 'normal',
    measure_snapshot: 'check',
    target_snapshot: null,
    min_snapshot: null,
    full_version_snapshot: '',
    min_version_snapshot: '',
    core_snapshot: false,
    auto_source_snapshot: 'none',
    completed_at: null,
    completed_via: null,
    award_revision: 0,
    ...over,
  } as QuestInstance;
}

describe('buildSnapshot', () => {
  const base = {
    day: D,
    tz: 'Asia/Kolkata',
    settings: { day_start_hour: 3, wake_late_cutoff: '07:00' },
    startDay: '2026-10-01',
    level: { level: 12, xpIntoLevel: 340, xpForNext: 1200, progress: 0.283 },
    streak: 9,
    lowEnergy: false,
  };

  it('level, XP, day, open quests first (max 4), kinds and the stale time', () => {
    const s = buildSnapshot({
      ...base,
      quests: [
        {
          instance: inst({ id: 'w', title_snapshot: 'Wake', auto_source_snapshot: 'wake_checkin' }),
          progress: 0,
        },
        {
          instance: inst({
            id: 'a',
            title_snapshot: 'Study',
            measure_snapshot: 'minutes',
            target_snapshot: 150,
          }),
          progress: 45,
        },
        {
          instance: inst({ id: 'b', title_snapshot: 'Workout', status: 'done_full' }),
          progress: 0,
        },
        { instance: inst({ id: 'c', title_snapshot: 'Journal' }), progress: 0 },
        {
          instance: inst({
            id: 'd',
            title_snapshot: 'Walk',
            measure_snapshot: 'steps',
            target_snapshot: 8000,
          }),
          progress: 3200,
        },
      ],
    });
    expect(s).toMatchObject({
      level: 12,
      xpLabel: '340 / 1,200 XP',
      progress: 28,
      dayLabel: 'Day 33',
      total: 5,
      doneCount: 1,
      validUntil: ist(2026, 11, 3, 3),
      wakeUntil: ist(2026, 11, 2, 7),
    });
    expect(s.quests.map((q) => [q.id, q.kind, q.detail])).toEqual([
      ['w', 'wake', ''],
      ['a', 'open', '45 / 150 min'],
      ['c', 'check', ''],
      ['d', 'open', '3,200 / 8,000'],
    ]);
  });

  it('low energy hides non-core quests that are not done, like Today', () => {
    const s = buildSnapshot({
      ...base,
      lowEnergy: true,
      quests: [
        { instance: inst({ id: 'core', core_snapshot: true }), progress: 0 },
        { instance: inst({ id: 'extra' }), progress: 0 },
        { instance: inst({ id: 'done', status: 'done_min' }), progress: 0 },
      ],
    });
    expect(s.quests.map((q) => [q.id, q.detail])).toEqual([
      ['core', 'Core'],
      ['done', 'Minimum'],
    ]);
    expect(s.wakeUntil).toBeNull();
  });
});

describe('pending-actions queue', () => {
  let t: Awaited<ReturnType<typeof createTestDb>>;
  let ids: Record<string, string>;

  function fakeBridge(taps: PendingTap[]): WidgetBridge & { queue: PendingTap[] } {
    return {
      queue: [...taps],
      setSnapshot: async () => undefined,
      async peekPending() {
        return [...this.queue];
      },
      async removePending(remove) {
        this.queue = this.queue.filter((x) => !remove.includes(x.id));
      },
    };
  }

  beforeEach(async () => {
    t = await createTestDb(ist(2026, 11, 2, 5, 5));
    ids = {};
    for (const key of ['wake-up', 'workout', 'journal']) {
      const h = STARTER_HABITS.find(
        (x) => x.key === key || (key === 'wake-up' && x.auto_source === 'wake_checkin'),
      );
      if (!h) throw new Error(`missing ${key}`);
      const r = await t.run<{ id: string }>({ type: 'habit.create', payload: habitFieldsOf(h) });
      ids[key] = `${r.value?.id}:${D}`;
    }
    await ensureInstancesForDay(t.db, D);
  });
  afterEach(() => t.cleanup());

  it('taps count at their real time, once, then leave the phone’s queue', async () => {
    const bridge = fakeBridge([
      {
        id: 'w-1',
        type: 'quest.wakeCheckin',
        payload: { instanceId: ids['wake-up'] },
        occurred_at: new Date(ist(2026, 11, 2, 5, 2)).toISOString(),
      },
      {
        id: 'w-2',
        type: 'quest.complete',
        payload: { instanceId: ids.workout, version: 'full' },
        occurred_at: new Date(ist(2026, 11, 2, 5, 4)).toISOString(),
      },
    ]);
    // Processed much later: the wake-up still counts as on time (tapped at 5:02).
    setNow(ist(2026, 11, 2, 9));
    const r = await processPending(bridge, t.db);
    expect(r).toEqual({ processed: 2, problems: [] });
    expect(bridge.queue).toEqual([]);
    expect(await t.db.quest_instances.get(ids['wake-up'] ?? '')).toMatchObject({
      status: 'done_full',
      completed_via: 'widget',
    });
    expect((await t.db.quest_instances.get(ids.workout ?? ''))?.status).toBe('done_full');
    expect((await t.db.pending_actions.toArray()).every((p) => p.processed_at !== null)).toBe(true);

    // The same tap delivered again (e.g. the phone kept it): nothing new.
    const again = fakeBridge([
      {
        id: 'w-2',
        type: 'quest.complete',
        payload: { instanceId: ids.workout, version: 'full' },
        occurred_at: new Date(ist(2026, 11, 2, 5, 4)).toISOString(),
      },
    ]);
    await processPending(again, t.db);
    expect(await t.db.xp_events.count()).toBe(2);
  });

  it('a tap a rule refuses is reported once and not retried; unknown actions are ignored', async () => {
    const bridge = fakeBridge([
      {
        id: 'late',
        type: 'quest.wakeCheckin',
        payload: { instanceId: ids['wake-up'] },
        occurred_at: new Date(ist(2026, 11, 2, 8)).toISOString(),
      },
      {
        id: 'evil',
        type: 'data.import',
        payload: {},
        occurred_at: new Date(ist(2026, 11, 2, 8)).toISOString(),
      },
    ]);
    setNow(ist(2026, 11, 2, 9));
    const r = await processPending(bridge, t.db);
    expect(r.problems).toEqual(['The wake-up window has closed for today']);
    expect(bridge.queue).toEqual([]);
    expect(await t.db.pending_actions.count()).toBe(1);
    expect((await processPending(fakeBridge([]), t.db)).problems).toEqual([]);
  });

  it('yesterday’s tap still counts for yesterday after the day closed', async () => {
    await t.db.profile.put({
      ...newBase('profile'),
      name: 'R',
      start_day: '2026-11-01',
      onboarded_at: 'x',
      display_title: null,
    });
    const bridge = fakeBridge([
      {
        id: 'j',
        type: 'quest.complete',
        payload: { instanceId: ids.journal, version: 'full' },
        occurred_at: new Date(ist(2026, 11, 2, 23)).toISOString(),
      },
    ]);
    setNow(ist(2026, 11, 3, 8));
    await t.run({ type: 'day.rollover', payload: {} });
    expect((await t.db.quest_instances.get(ids.journal ?? ''))?.status).toBe('missed');
    await processPending(bridge, t.db);
    expect((await t.db.quest_instances.get(ids.journal ?? ''))?.status).toBe('done_full');
  });
});

describe('deep links', () => {
  it('only app.ascend.rishi://open/<screen> opens a screen', () => {
    expect(pathFromLink('app.ascend.rishi://open/focus')).toBe('/focus');
    expect(pathFromLink('app.ascend.rishi://auth?code=1')).toBeNull();
    expect(pathFromLink('app.ascend.rishi://open/<script>')).toBe('/script');
  });
});

describe('widget palette (Phase 12)', () => {
  it('carries the current theme’s colours; unbuilt or unknown themes fall back to ELEVATE', () => {
    const elevate = widgetPalette('elevate');
    expect(elevate).toEqual({
      bg: '#000000',
      surface: '#161616',
      text: '#F2F2F2',
      muted: '#9A9A9A',
      accent: '#C8F03C',
      onAccent: '#000000',
    });
    expect(widgetPalette(undefined)).toEqual(elevate);
    expect(widgetPalette('void')).toEqual(elevate); // not built yet
    expect(widgetPalette('nonsense')).toEqual(elevate);
    for (const colour of Object.values(elevate)) expect(colour).toMatch(/^#[0-9A-F]{6}$/i);
  });
});
