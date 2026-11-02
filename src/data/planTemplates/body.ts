import type { PlanMilestone, PlanTemplate } from '@/core/planner/types';
import { DAYS, MINUTES, num, obstacleWeekly, scheduleFor, str } from './shared';

/** Fitness / body recomposition. Weight milestones are read from body logs (metric). */
export const fitness: PlanTemplate = {
  id: 'fitness',
  name: 'Fitness and body',
  keywords: [
    'weight',
    'fat',
    'muscle',
    'fitness',
    'gym',
    'body',
    'recomposition',
    'lose',
    'kg',
    'strength',
    'run',
    'marathon',
    'physique',
  ],
  stat: 'STR',
  questions: [
    {
      id: 'focus',
      label: 'Main focus',
      kind: 'chips',
      options: [
        { value: 'lose', label: 'Lose fat' },
        { value: 'gain', label: 'Build muscle' },
        { value: 'recomp', label: 'Both (recomposition)' },
      ],
      default: 'recomp',
    },
    {
      id: 'start_weight',
      label: 'Weight now',
      kind: 'slider',
      min: 40,
      max: 150,
      step: 0.5,
      unit: 'kg',
      default: 75,
    },
    {
      id: 'target_weight',
      label: 'Target weight',
      kind: 'slider',
      min: 40,
      max: 150,
      step: 0.5,
      unit: 'kg',
      default: 70,
    },
    {
      id: 'workouts',
      label: 'Workouts per week',
      kind: 'slider',
      min: 2,
      max: 6,
      step: 1,
      default: 4,
    },
  ],
  build(a) {
    const start = num(a, 'start_weight', 75);
    const target = num(a, 'target_weight', 70);
    const workouts = num(a, 'workouts', 4);
    const down = target < start;
    const milestones: PlanMilestone[] = [
      {
        title: 'Four weeks of consistent training',
        weeks: 4,
        weight: 1,
        target_type: 'manual',
        target_value: null,
        current_source: null,
        estimated_weekly_quests: 4,
        weekly: [`${workouts} workouts this week`, 'Log body weight twice', ...obstacleWeekly(a)],
      },
    ];
    if (Math.abs(target - start) >= 1) {
      // Safe pace (SPEC 6.2 guardrails): about 0.5 kg per week, split into two steps.
      const half = Math.round(((start + target) / 2) * 2) / 2;
      const weeksFor = (kg: number) => Math.max(3, Math.round(Math.abs(kg) / 0.5));
      for (const [goal, from] of [
        [half, start],
        [target, half],
      ] as const) {
        milestones.push({
          title: `Reach ${goal} kg`,
          weeks: weeksFor(goal - from),
          weight: 2,
          target_type: 'metric',
          target_value: goal,
          current_source: {
            kind: 'body_metric',
            metric: 'weight',
            direction: down ? 'down' : 'up',
            start_value: from,
          },
          estimated_weekly_quests: null,
          weekly: [
            `${workouts} workouts this week`,
            'Plan meals for three days',
            'Log body weight twice',
          ],
        });
      }
    }
    return {
      weeklyPerWeek: 2,
      milestones,
      habits: [
        {
          title: 'Protein with every meal',
          stat: 'STR',
          difficulty: 'easy',
          measure: 'check',
          target_value: null,
          min_value: null,
          full_version: 'Protein in every meal today',
          min_version: 'Protein in one meal',
          schedule: [0, 1, 2, 3, 4, 5, 6],
        },
      ],
    };
  },
};

/** Building or breaking a habit. Progress counts the days the linked habit was done. */
export const habitChange: PlanTemplate = {
  id: 'habit',
  name: 'Habit change',
  keywords: [
    'habit',
    'quit',
    'stop',
    'daily',
    'routine',
    'phone',
    'sleep',
    'meditate',
    'journal',
    'read',
    'wake',
    'consistency',
  ],
  stat: 'WIL',
  questions: [
    {
      id: 'direction',
      label: 'Build or break?',
      kind: 'chips',
      options: [
        { value: 'build', label: 'Build a habit' },
        { value: 'break', label: 'Break a habit' },
      ],
      default: 'build',
    },
    MINUTES,
    DAYS,
  ],
  build(a, ctx) {
    const breaking = str(a, 'direction', 'build') === 'break';
    const step = (days: number, weeks: number, weight: 1 | 2 | 3): PlanMilestone => ({
      title: `${days} days done`,
      weeks,
      weight,
      target_type: 'count',
      target_value: days,
      current_source: { kind: 'linked_quests' },
      estimated_weekly_quests: null,
      weekly: ['Review the week: what made it easy or hard?', ...obstacleWeekly(a)],
    });
    return {
      weeklyPerWeek: 1,
      milestones: [step(14, 3, 1), step(30, 3, 2), step(66, 6, 3)],
      habits: [
        {
          title: ctx.goalTitle,
          stat: 'WIL',
          difficulty: 'normal',
          measure: 'check',
          target_value: null,
          min_value: null,
          full_version: breaking
            ? 'A full day without it'
            : `${num(a, 'minutes_per_day', 20)} minutes`,
          min_version: breaking ? 'Resisted it once, on purpose' : '2 minutes',
          schedule: scheduleFor(a),
        },
      ],
    };
  },
};
