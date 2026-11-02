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

const only = (keys: (keyof typeof DEFAULT_SETTINGS.notifications)[]) => ({
  ...DEFAULT_SETTINGS,
  notifications: {
    ...DEFAULT_SETTINGS.notifications,
    wake_checkin: keys.includes('wake_checkin'),
    morning_briefing: keys.includes('morning_briefing'),
    quest_reminders: keys.includes('quest_reminders'),
    evening_winddown: keys.includes('evening_winddown'),
  },
});
const input = (over: Partial<PlanInput> = {}): PlanInput => ({
  now: ist(2026, 11, 2, 4, 0),
  tz: TZ,
  today: '2026-11-02',
  settings: only(['wake_checkin']),
  startDay: '2026-11-01',
  habits: [wake],
  todayInstances: [],
  checkInDone: false,
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
          todayInstances: [
            {
              id: 'wake:2026-11-02',
              source_type: 'habit',
              source_id: 'wake',
              status: 'done_full',
              core_snapshot: true,
            },
          ],
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
    const off = only([]);
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

const study = {
  ...wake,
  id: 'study',
  title: 'Study',
  auto_source: 'none',
  measure: 'minutes',
  target_value: 60,
  min_value: 15,
  core: true,
} as Habit;
const journal = {
  ...wake,
  id: 'journal',
  title: 'Journal',
  auto_source: 'none',
  core: false,
} as Habit;
const inst = (id: string, status: 'pending' | 'done_full', core: boolean) => ({
  id: `${id}:2026-11-02`,
  source_type: 'habit' as const,
  source_id: id,
  status,
  core_snapshot: core,
});

describe('planNotifications: briefing, reminder, wind-down', () => {
  const all = only(['morning_briefing', 'quest_reminders', 'evening_winddown']);
  const habits = [wake, study, journal];

  it('today: counts what’s still open; the reminder only while core quests are open', () => {
    const list = planNotifications(
      input({
        settings: all,
        habits,
        todayInstances: [
          inst('wake', 'done_full', true),
          inst('study', 'pending', true),
          inst('journal', 'pending', false),
        ],
      }),
    ).filter((n) => n.day === '2026-11-02');
    expect(list.map((n) => [n.key, n.title, n.body])).toEqual([
      ['briefing:2026-11-02', 'Day 2. 2 quests today.', '1 core. Start with the smallest.'],
      [
        'reminder:2026-11-02',
        '1 core quest still open.',
        'The minimum versions count — they keep the day active.',
      ],
      [
        'winddown:2026-11-02',
        'Time to wind down.',
        'How did today go? The check-in takes a minute.',
      ],
    ]);
    expect(list[0]?.at).toBe(ist(2026, 11, 2, 5, 20)); // when the wake-up window ends
    expect(list[1]?.at).toBe(ist(2026, 11, 2, 18, 0));
    expect(list[2]).toMatchObject({ at: ist(2026, 11, 2, 21, 0), path: '/review' });

    const done = planNotifications(
      input({
        settings: all,
        habits,
        checkInDone: true,
        todayInstances: [
          inst('wake', 'done_full', true),
          inst('study', 'done_full', true),
          inst('journal', 'done_full', false),
        ],
      }),
    ).filter((n) => n.day === '2026-11-02');
    expect(done).toEqual([]); // nothing open, check-in saved
  });

  it('later days: generic but honest; Day 1 has no core reminder', () => {
    const later = planNotifications(input({ settings: all, habits })).filter(
      (n) => n.day === '2026-11-03',
    );
    expect(later.map((n) => n.title)).toEqual([
      'Day 3. 3 quests today.',
      'Core quests still open?',
      'Time to wind down.',
    ]);
    const day1 = planNotifications(input({ settings: all, habits, startDay: '2026-11-03' })).filter(
      (n) => n.day === '2026-11-03',
    );
    expect(day1.map((n) => n.kind)).toEqual(['briefing', 'winddown']);
    expect(day1[0]?.body).toBe('Start with the smallest.');
  });

  it('every kind follows its switch and the evening time', () => {
    const late = { ...all, notifications: { ...all.notifications, evening_time: '22:30' } };
    const wind = planNotifications(input({ settings: late, habits })).find(
      (n) => n.kind === 'winddown',
    );
    expect(wind?.at).toBe(ist(2026, 11, 2, 22, 30));
    expect(planNotifications(input({ settings: only([]), habits }))).toEqual([]);
  });
});
