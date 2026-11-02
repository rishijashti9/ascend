import { DEFAULT_SETTINGS } from '@/config/defaults';
import type { Habit } from '@/core/db/types';
import { newBase } from '@/core/pipeline';
import { ist } from '@/test/testDb';
import { appInstant, planNotifications, type PlanInput } from './plan';

const TZ = 'Asia/Kolkata';
const wake: Habit = {
  ...newBase('wake'),
  title: 'Wake up on time',
  stat: 'WIL',
  difficulty: 'normal',
  schedule: [0, 1, 2, 3, 4, 5, 6],
  full_version: 'Up',
  min_version: 'Up late',
  measure: 'check',
  target_value: null,
  min_value: null,
  core: true,
  auto_source: 'wake_checkin',
  linked_goal_type: null,
  linked_goal_id: null,
  skill_ids: [],
  status: 'active',
  planned_by: 'me',
  order: 0,
} as Habit;

const input = (over: Partial<PlanInput> = {}): PlanInput => ({
  now: ist(2026, 11, 2, 4, 0),
  tz: TZ,
  today: '2026-11-02',
  settings: DEFAULT_SETTINGS,
  startDay: '2026-11-01',
  habits: [wake],
  todayInstances: [],
  ...over,
});

describe('planNotifications: wake-up check-in', () => {
  it('one per scheduled day for 7 days at wake time, with Day N and the I’m up instance', () => {
    const list = planNotifications(input());
    expect(list).toHaveLength(7);
    expect(list[0]).toEqual({
      key: 'wake:2026-11-02',
      kind: 'wake',
      at: ist(2026, 11, 2, 5, 0),
      day: '2026-11-02',
      title: 'Day 2. Are you up?',
      body: 'Tap “I’m up” — it counts the moment you tap (on time for 20 min).',
      path: '/',
      wakeInstanceId: 'wake:2026-11-02',
    });
    expect(list.at(-1)?.key).toBe('wake:2026-11-08');
  });

  it('skips today once done or once the time has passed, unscheduled days, and before Day 1', () => {
    expect(
      planNotifications(
        input({
          todayInstances: [{ id: 'wake:2026-11-02', source_id: 'wake', status: 'done_full' }],
        }),
      )[0]?.key,
    ).toBe('wake:2026-11-03');
    expect(planNotifications(input({ now: ist(2026, 11, 2, 6, 0) }))[0]?.key).toBe(
      'wake:2026-11-03',
    );
    const weekdays = { ...wake, schedule: [1, 2, 3, 4, 5] } as Habit; // Mon–Fri
    expect(planNotifications(input({ habits: [weekdays] })).map((n) => n.day)).toEqual([
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
    ]);
    expect(planNotifications(input({ startDay: '2026-11-05' }))[0]?.title).toBe(
      'Day 1. Are you up?',
    );
    expect(planNotifications(input({ startDay: null }))).toEqual([]);
  });

  it('respects the switch and a paused wake-up quest', () => {
    const off = {
      ...DEFAULT_SETTINGS,
      notifications: { ...DEFAULT_SETTINGS.notifications, wake_checkin: false },
    };
    expect(planNotifications(input({ settings: off }))).toEqual([]);
    expect(planNotifications(input({ habits: [{ ...wake, status: 'paused' } as Habit] }))).toEqual(
      [],
    );
  });

  it('a clock time before the day-start hour belongs to the next calendar date', () => {
    expect(appInstant('2026-11-02', '02:00', TZ, 3)).toBe(ist(2026, 11, 3, 2, 0));
    expect(appInstant('2026-11-02', '05:00', TZ, 3)).toBe(ist(2026, 11, 2, 5, 0));
  });
});
