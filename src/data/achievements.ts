import type { FeatureKey } from '@/config/features';
import type { AchievementFacts } from '@/core/engine/achievements';

/**
 * Achievements (SPEC 4.7): original, quiet, tied to real behaviour. Each one is unlocked when
 * one number from the player's history reaches its goal, so adding a new one is one line here.
 * `feature`: hidden until that feature is built and switched on (SPEC 0.1: no locked
 * achievements for features that don't exist yet). Keys are permanent — never rename one.
 */
export interface AchievementDef {
  key: string;
  name: string;
  description: string;
  group: AchievementGroup;
  metric: keyof AchievementFacts;
  goal: number;
  feature?: FeatureKey;
}

export type AchievementGroup =
  | 'Showing up'
  | 'Streaks'
  | 'Mornings'
  | 'Habits'
  | 'Growth'
  | 'Quests'
  | 'Focus'
  | 'Goals'
  | 'Reflection'
  | 'Body'
  | 'Career';

// prettier-ignore
export const ACHIEVEMENTS: readonly AchievementDef[] = [
  // Showing up
  { key: 'first-step', name: 'First Step', description: 'Your first active day', group: 'Showing up', metric: 'activeDays', goal: 1 },
  { key: 'seven-days', name: 'Seven Days', description: '7 active days', group: 'Showing up', metric: 'activeDays', goal: 7 },
  { key: 'thirty-days', name: 'Thirty Days', description: '30 active days', group: 'Showing up', metric: 'activeDays', goal: 30 },
  { key: 'centurion', name: 'Centurion', description: '100 active days', group: 'Showing up', metric: 'activeDays', goal: 100 },
  { key: 'the-long-road', name: 'The Long Road', description: '365 active days', group: 'Showing up', metric: 'activeDays', goal: 365 },
  { key: 'clean-sweep', name: 'Clean Sweep', description: 'Your first Daily Clear', group: 'Showing up', metric: 'dailyClears', goal: 1 },
  { key: 'ten-clears', name: 'Ten Clears', description: '10 Daily Clears', group: 'Showing up', metric: 'dailyClears', goal: 10 },
  { key: 'fifty-clears', name: 'Fifty Clears', description: '50 Daily Clears', group: 'Showing up', metric: 'dailyClears', goal: 50 },
  { key: 'comeback', name: 'Comeback', description: 'Finish a Recovery quest after a missed day', group: 'Showing up', metric: 'recoveriesDone', goal: 1 },
  { key: 'showed-up-anyway', name: 'Showed Up Anyway', description: '5 low-energy days that were still active', group: 'Showing up', metric: 'lowEnergyActiveDays', goal: 5 },
  // Streaks
  { key: 'kindling', name: 'Kindling', description: 'A 3-day streak', group: 'Streaks', metric: 'longestStreak', goal: 3 },
  { key: 'steady-flame', name: 'Steady Flame', description: 'A 14-day streak', group: 'Streaks', metric: 'longestStreak', goal: 14 },
  { key: 'unbroken', name: 'Unbroken', description: 'A 30-day streak', group: 'Streaks', metric: 'longestStreak', goal: 30 },
  { key: 'iron-will', name: 'Iron Will', description: 'A 100-day streak', group: 'Streaks', metric: 'longestStreak', goal: 100 },
  // Mornings
  { key: 'first-light', name: 'First Light', description: '7 wake-ups on time', group: 'Mornings', metric: 'wakeOnTime', goal: 7 },
  { key: 'dawn-keeper', name: 'Dawn Keeper', description: '30 wake-ups on time', group: 'Mornings', metric: 'wakeOnTime', goal: 30 },
  { key: 'hundred-dawns', name: 'Hundred Dawns', description: '100 wake-ups on time', group: 'Mornings', metric: 'wakeOnTime', goal: 100 },
  // Habits
  { key: 'iron-habit', name: 'Iron Habit', description: 'A 30-day workout streak', group: 'Habits', metric: 'workoutStreak', goal: 30 },
  { key: 'rooted', name: 'Rooted', description: 'Any daily quest kept for 60 scheduled days in a row', group: 'Habits', metric: 'habitStreak', goal: 60 },
  // Growth
  { key: 'awakened', name: 'Awakened', description: 'Reach level 5', group: 'Growth', metric: 'level', goal: 5 },
  { key: 'ascending', name: 'Ascending', description: 'Reach level 15', group: 'Growth', metric: 'level', goal: 15 },
  { key: 'seasoned', name: 'Seasoned', description: 'Reach level 30', group: 'Growth', metric: 'level', goal: 30 },
  { key: 'proven', name: 'Proven', description: 'Reach rank D', group: 'Growth', metric: 'rankIndex', goal: 1 },
  { key: 'tempered', name: 'Tempered', description: 'Reach rank C', group: 'Growth', metric: 'rankIndex', goal: 2 },
  { key: 'veteran', name: 'Veteran', description: 'Reach rank B', group: 'Growth', metric: 'rankIndex', goal: 3 },
  { key: 'strong-body', name: 'Strong Body', description: 'Strength level 10', group: 'Growth', metric: 'strLevel', goal: 10 },
  { key: 'sharp-mind', name: 'Sharp Mind', description: 'Intellect level 10', group: 'Growth', metric: 'intLevel', goal: 10 },
  { key: 'steel-will', name: 'Steel Will', description: 'Willpower level 10', group: 'Growth', metric: 'wilLevel', goal: 10 },
  { key: 'in-balance', name: 'In Balance', description: 'Every stat at level 5 or higher', group: 'Growth', metric: 'lowestStatLevel', goal: 5 },
  // Quests
  { key: 'quest-log', name: 'Quest Log', description: '100 quests completed', group: 'Quests', metric: 'questsDone', goal: 100 },
  { key: 'thousand-tasks', name: 'Thousand Tasks', description: '1,000 quests completed', group: 'Quests', metric: 'questsDone', goal: 1000 },
  { key: 'week-by-week', name: 'Week by Week', description: '20 weekly quests done', group: 'Quests', metric: 'weeklyDone', goal: 20 },
  { key: 'loose-ends', name: 'Loose Ends', description: '10 side quests done', group: 'Quests', metric: 'sideDone', goal: 10 },
  // Focus
  { key: 'deep-dive', name: 'Deep Dive', description: 'Finish your first focus session', group: 'Focus', metric: 'focusCompleted', goal: 1 },
  { key: 'ten-hours-deep', name: 'Ten Hours Deep', description: '10 hours of focus', group: 'Focus', metric: 'focusMinutes', goal: 600 },
  { key: 'hundred-hours', name: 'Hundred Hours', description: '100 hours of focus', group: 'Focus', metric: 'focusMinutes', goal: 6000 },
  { key: 'marathon', name: 'Marathon', description: 'Finish a 90-minute focus session', group: 'Focus', metric: 'longestSession', goal: 90 },
  { key: 'out-of-reach', name: 'Out of Reach', description: '25 focus sessions with the phone face-down', group: 'Focus', metric: 'faceDownSessions', goal: 25 },
  // Goals
  { key: 'milestone', name: 'Milestone', description: 'Finish your first milestone', group: 'Goals', metric: 'milestonesDone', goal: 1 },
  { key: 'mile-markers', name: 'Mile Markers', description: 'Finish 10 milestones', group: 'Goals', metric: 'milestonesDone', goal: 10 },
  { key: 'summit', name: 'Summit', description: 'Finish a main quest', group: 'Goals', metric: 'mainQuestsDone', goal: 1 },
  // Reflection
  { key: 'looking-back', name: 'Looking Back', description: '7 daily check-ins', group: 'Reflection', metric: 'checkIns', goal: 7 },
  { key: 'weekly-ritual', name: 'Weekly Ritual', description: '4 weekly reviews', group: 'Reflection', metric: 'weeklyReviews', goal: 4 },
  // Body
  { key: 'body-logbook', name: 'Body Logbook', description: '30 days of body logs', group: 'Body', metric: 'bodyLogDays', goal: 30 },
  // Career (Phase 9)
  { key: 'applicant', name: 'Applicant', description: 'Your first 10 job applications', group: 'Career', metric: 'jobApplications', goal: 10, feature: 'jobs' },
  { key: 'persistent', name: 'Persistent', description: '50 job applications', group: 'Career', metric: 'jobApplications', goal: 50, feature: 'jobs' },
];
