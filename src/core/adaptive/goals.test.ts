import type { MainQuest, Milestone } from '@/core/db/types';
import { goalNudges } from '@/core/planner/nudges';
import {
  behindMessage,
  focusGoalOfWeek,
  mainQuestForecast,
  milestoneForecast,
  type Forecast,
} from './goals';

const TODAY = '2026-11-30';
const base = { updated_at: '', deleted_at: null, schema_version: 1, hlc: 'h' };
const dayOfIso = (iso: string) => iso.slice(0, 10);

const ms = (id: string, over: Partial<Milestone> = {}): Milestone => ({
  ...base,
  id,
  created_at: '2026-11-02T06:00:00.000Z',
  main_quest_id: 'q',
  title: id,
  size_weight: 1,
  target_type: 'count',
  target_value: 10,
  current_source: null,
  estimated_weekly_quests: null,
  target_date: '2026-12-15',
  status: 'active',
  done_at: null,
  planner_context: {},
  order: 0,
  ...over,
});
const mq = (id: string, over: Partial<MainQuest> = {}): MainQuest => ({
  ...base,
  id,
  created_at: '2026-11-02T06:00:00.000Z',
  dream_id: 'd',
  title: id,
  why: '',
  stat: 'INT',
  target_date: null,
  status: 'active',
  order: 0,
  planner_context: {},
  last_checkin_day: TODAY,
  ...over,
});

describe('pace forecasts (SPEC 6.7 A)', () => {
  it('40% in 4 weeks → about 6 more weeks; late against a mid-December date', () => {
    const f = milestoneForecast(ms('a'), 0.4, '2026-11-02', TODAY);
    expect(f.finish).toBe('2027-01-11');
    expect(f.lateBy).toBe(27);
    expect(f.confidence).toBe('confident');
    expect(f.why).toBe('At your pace (40% in 4 weeks), about 6 weeks more — around 11 Jan.');
    expect(behindMessage('a', f, '2026-12-15')).toMatch(/4 weeks after its date \(15 Dec\)/);
  });

  it('too early, or no progress yet, gives no finish day', () => {
    expect(milestoneForecast(ms('a'), 0.3, '2026-11-27', TODAY).finish).toBeNull();
    const none = milestoneForecast(ms('a'), 0, '2026-11-02', TODAY);
    expect(none.finish).toBeNull();
    expect(none.why).toBe('No progress yet in 4 weeks.');
  });

  it('on pace → not behind', () => {
    const f = milestoneForecast(ms('a'), 0.7, '2026-11-02', TODAY);
    expect(behindMessage('a', f, '2026-12-15')).toBeNull();
  });

  it('main quest: active milestone, then the rest at the same pace', () => {
    const list = [ms('a', { order: 0 }), ms('b', { order: 1, status: 'upcoming', size_weight: 2 })];
    const f = mainQuestForecast(
      mq('q', { target_date: '2027-02-01' }),
      list,
      (id) => (id === 'a' ? 0.5 : 0),
      TODAY,
      dayOfIso,
    );
    // a: 50% in 28 days → 28 more (28 Dec); b is twice as big → 112 days more.
    expect(f?.finish).toBe('2027-04-19');
    expect(f?.lateBy).toBeGreaterThan(7);
  });

  it('the focus goal of the week is the one furthest behind, else the nearest deadline', () => {
    const quests = [mq('x', { target_date: '2027-03-01' }), mq('y', { target_date: '2027-01-10' })];
    const late: Forecast = { finish: '2027-05-01', lateBy: 60, confidence: 'likely', why: '' };
    const ok: Forecast = { finish: '2027-01-01', lateBy: -9, confidence: 'likely', why: '' };
    expect(
      focusGoalOfWeek(
        quests,
        new Map([
          ['x', late],
          ['y', ok],
        ]),
        () => 0.2,
        TODAY,
      )?.mainQuestId,
    ).toBe('x');
    const f = focusGoalOfWeek(
      quests,
      new Map([
        ['x', ok],
        ['y', ok],
      ]),
      () => 0.2,
      TODAY,
    );
    expect(f?.mainQuestId).toBe('y');
    expect(f?.why).toMatch(/deadline is the nearest \(10 Jan\)/);
  });

  it('goal nudges warn early from the pace, before the share-of-time rule would', () => {
    // 45% done with 64% of the time used: not 25 points behind yet, but the pace says late.
    const nudges = goalNudges({
      today: TODAY,
      mainQuests: [mq('q')],
      milestones: [ms('a', { target_date: '2026-12-16' })],
      milestoneProgress: { a: { progress: 0.45 } },
      dayOfIso,
    });
    expect(nudges).toEqual([
      expect.objectContaining({
        kind: 'risk',
        milestoneId: 'a',
        message: expect.stringMatching(/At your current pace/),
      }),
    ]);
  });
});
