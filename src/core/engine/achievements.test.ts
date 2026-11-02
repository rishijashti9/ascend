import { features, type FeatureKey } from '@/config/features';
import { ACHIEVEMENTS } from '@/data/achievements';
import {
  achievementProgress,
  computeFacts,
  type AchievementFacts,
  type FactsInput,
} from './achievements';
import { levelFromXp } from './levels';

const lvl = (n: number) => ({ ...levelFromXp(0), level: n });

function input(over: Partial<FactsInput> = {}): FactsInput {
  return {
    progress: {
      level: lvl(6),
      rank: 'D',
      stats: { STR: lvl(5), INT: lvl(9), WIL: lvl(5) },
      streak: {
        streak: 4,
        longest: 15,
        daysActive: 31,
        shields: 0,
        repairable: null,
        lastRepairDay: null,
      },
      habitStreaks: { workout: { streak: 2, longest: 30 }, read: { streak: 1, longest: 61 } },
      perDay: {
        '2026-11-01': { xp: 10, active: true, dailyClear: true, streak: 1, questsDone: 3 },
        '2026-11-02': { xp: 10, active: true, dailyClear: false, streak: 2, questsDone: 1 },
      },
    },
    days: [
      { day: '2026-11-01', active: true, low_energy: true, deleted_at: null },
      { day: '2026-11-02', active: false, low_energy: true, deleted_at: null },
    ],
    instances: [
      {
        id: 'wake:2026-11-01',
        source_type: 'habit',
        source_id: 'wake',
        status: 'done_full',
        auto_source_snapshot: 'wake_checkin',
        deleted_at: null,
      },
      {
        id: 'wake:2026-11-02',
        source_type: 'habit',
        source_id: 'wake',
        status: 'done_late',
        auto_source_snapshot: 'wake_checkin',
        deleted_at: null,
      },
      {
        id: 'w1:2026-11-02',
        source_type: 'quest',
        source_id: 'w1',
        status: 'done_full',
        auto_source_snapshot: 'none',
        deleted_at: null,
      },
      {
        id: 's1',
        source_type: 'quest',
        source_id: 's1',
        status: 'done_min',
        auto_source_snapshot: 'none',
        deleted_at: null,
      },
      {
        id: 's2',
        source_type: 'quest',
        source_id: 's2',
        status: 'pending',
        auto_source_snapshot: 'none',
        deleted_at: null,
      },
      {
        id: 'recovery:2026-10-30',
        source_type: 'quest',
        source_id: 'recovery:2026-10-30',
        status: 'done_full',
        auto_source_snapshot: 'none',
        deleted_at: null,
      },
      {
        id: 'x',
        source_type: 'habit',
        source_id: 'read',
        status: 'done_full',
        auto_source_snapshot: 'none',
        deleted_at: '2026-11-02T00:00:00Z',
      },
    ],
    habits: [
      { id: 'workout', auto_source: 'workout' },
      { id: 'read', auto_source: 'none' },
      { id: 'wake', auto_source: 'wake_checkin' },
    ],
    quests: [
      { id: 'w1', type: 'weekly' },
      { id: 's1', type: 'side' },
      { id: 's2', type: 'side' },
    ],
    sessions: [
      { actual_min: 90, completed: true, face_down: true, ended_at: 'x', deleted_at: null },
      { actual_min: 20, completed: false, face_down: false, ended_at: 'x', deleted_at: null },
      { actual_min: 50, completed: false, face_down: false, ended_at: null, deleted_at: null }, // running
    ],
    milestones: [
      { status: 'done', deleted_at: null },
      { status: 'active', deleted_at: null },
    ],
    mainQuests: [{ status: 'done', deleted_at: null }],
    reviews: [
      { type: 'daily', deleted_at: null },
      { type: 'weekly', deleted_at: null },
      { type: 'daily', deleted_at: 'gone' },
    ],
    bodyLogs: [
      {
        weight: 72,
        waist: null,
        sleep_hours: null,
        steps: null,
        workout_notes: null,
        deleted_at: null,
      },
      {
        weight: null,
        waist: null,
        sleep_hours: null,
        steps: null,
        workout_notes: null,
        deleted_at: null,
      }, // empty
    ],
    jobs: [
      { applied_at: '2026-11-01', deleted_at: null },
      { applied_at: null, deleted_at: null },
    ],
    ...over,
  };
}

describe('computeFacts', () => {
  it('counts every family from stored records (deleted and unfinished things left out)', () => {
    expect(computeFacts(input())).toEqual<AchievementFacts>({
      activeDays: 31,
      dailyClears: 1,
      longestStreak: 15,
      recoveriesDone: 1,
      lowEnergyActiveDays: 1,
      wakeOnTime: 1, // a late wake-up doesn't count
      workoutStreak: 30,
      habitStreak: 61,
      level: 6,
      rankIndex: 1,
      strLevel: 5,
      intLevel: 9,
      wilLevel: 5,
      lowestStatLevel: 5,
      questsDone: 4, // Recovery quests are counted separately
      weeklyDone: 1,
      sideDone: 1,
      focusCompleted: 1,
      focusMinutes: 110, // running session not yet
      longestSession: 90,
      faceDownSessions: 1,
      milestonesDone: 1,
      mainQuestsDone: 1,
      checkIns: 1,
      weeklyReviews: 1,
      bodyLogDays: 1,
      jobApplications: 1,
    });
  });
  it('a player with nothing yet has zeroes (no -Infinity)', () => {
    const facts = computeFacts(
      input({
        instances: [],
        habits: [],
        sessions: [],
        progress: { ...input().progress, habitStreaks: {} },
      }),
    );
    expect(facts.longestSession).toBe(0);
    expect(facts.workoutStreak).toBe(0);
    expect(facts.habitStreak).toBe(0);
  });
});

describe('the achievements data file', () => {
  const metrics = Object.keys(computeFacts(input()));
  it('has about 40 well-formed achievements with unique keys and names', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(40);
    expect(new Set(ACHIEVEMENTS.map((a) => a.key)).size).toBe(ACHIEVEMENTS.length);
    expect(new Set(ACHIEVEMENTS.map((a) => a.name)).size).toBe(ACHIEVEMENTS.length);
    for (const a of ACHIEVEMENTS) {
      expect(a.key).toMatch(/^[a-z0-9-]+$/);
      expect(metrics).toContain(a.metric);
      expect(a.goal).toBeGreaterThan(0);
      if (a.feature) expect(Object.keys(features)).toContain(a.feature satisfies FeatureKey);
    }
  });
  it('includes the SPEC examples', () => {
    const byName = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.name, a]));
    expect(byName['First Light']).toMatchObject({ metric: 'wakeOnTime', goal: 7 });
    expect(byName['Iron Habit']).toMatchObject({ metric: 'workoutStreak', goal: 30 });
    expect(byName.Applicant).toMatchObject({
      metric: 'jobApplications',
      goal: 10,
      feature: 'jobs',
    });
    expect(byName.Centurion).toMatchObject({ metric: 'activeDays', goal: 100 });
  });
  it('progress is capped at 1 and met at the goal', () => {
    const facts = computeFacts(input());
    expect(achievementProgress({ metric: 'activeDays', goal: 100 }, facts)).toEqual({
      value: 31,
      progress: 0.31,
      met: false,
    });
    expect(achievementProgress({ metric: 'activeDays', goal: 31 }, facts).met).toBe(true);
    expect(achievementProgress({ metric: 'activeDays', goal: 7 }, facts).progress).toBe(1);
  });
});
