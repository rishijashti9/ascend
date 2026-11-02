import type { PlanTemplate } from '@/core/planner/types';
import { LEVEL, MINUTES, DAYS, minutesHabit, num, obstacleWeekly } from './shared';

/** Building a portfolio of projects. */
export const portfolioProject: PlanTemplate = {
  id: 'portfolio',
  name: 'Portfolio project',
  keywords: ['portfolio', 'project', 'projects', 'build', 'github', 'demo', 'showcase'],
  stat: 'INT',
  questions: [
    {
      id: 'projects',
      label: 'How many projects?',
      kind: 'slider',
      min: 1,
      max: 5,
      step: 1,
      default: 2,
    },
    LEVEL,
    MINUTES,
    DAYS,
  ],
  build(a) {
    const projects = num(a, 'projects', 2);
    return {
      weeklyPerWeek: 3,
      milestones: [
        {
          title: 'Pick the first project and define its scope',
          weeks: 1,
          weight: 1,
          target_type: 'manual',
          target_value: null,
          current_source: null,
          estimated_weekly_quests: 2,
          weekly: [
            'Write a one-paragraph project pitch and the “done” list',
            'Set up the repository and a README skeleton',
            ...obstacleWeekly(a),
          ],
        },
        {
          title: 'First project: working version',
          weeks: 5,
          weight: 3,
          target_type: 'manual',
          target_value: null,
          current_source: null,
          estimated_weekly_quests: 12,
          weekly: [
            'Build one core feature',
            'Get the main loop / pipeline running end to end',
            'Write tests or a short evaluation',
            'Record what broke and how you fixed it',
          ],
        },
        {
          title: 'Polish, document and publish',
          weeks: 2,
          weight: 1,
          target_type: 'manual',
          target_value: null,
          current_source: null,
          estimated_weekly_quests: 4,
          weekly: [
            'Write the README with results and a GIF/video',
            'Publish and share the project',
          ],
        },
        {
          title: `Projects published (${projects})`,
          weeks: Math.max(4, (projects - 1) * 6),
          weight: 3,
          target_type: 'count',
          target_value: projects,
          current_source: { kind: 'linked_quests' },
          estimated_weekly_quests: null,
          weekly: [
            'Publish a finished project (README + demo)',
            'Build one feature of the next project',
          ],
        },
      ],
      habits: [minutesHabit('Project build session', 'INT', num(a, 'minutes_per_day', 60), a)],
    };
  },
};

/** Job / internship / lab-position search. */
export const jobSearch: PlanTemplate = {
  id: 'jobs',
  name: 'Job search',
  keywords: ['job', 'jobs', 'internship', 'position', 'hired', 'offer', 'career', 'role', 'apply'],
  stat: 'INT',
  questions: [
    {
      id: 'applications_per_week',
      label: 'Applications per week you can manage',
      kind: 'slider',
      min: 1,
      max: 20,
      step: 1,
      default: 5,
    },
    LEVEL,
  ],
  build(a) {
    const perWeek = num(a, 'applications_per_week', 5);
    return {
      weeklyPerWeek: 3,
      milestones: [
        {
          title: 'CV, portfolio and profiles ready',
          weeks: 2,
          weight: 1,
          target_type: 'manual',
          target_value: null,
          current_source: null,
          estimated_weekly_quests: 4,
          weekly: [
            'Update the CV for the target role',
            'Refresh LinkedIn / GitHub profiles',
            ...obstacleWeekly(a),
          ],
        },
        {
          title: `Applications sent (${perWeek * 6})`,
          weeks: 6,
          weight: 3,
          target_type: 'count',
          target_value: perWeek * 6,
          current_source: { kind: 'job_applications', stage: 'applied' },
          estimated_weekly_quests: null,
          weekly: [
            `Send ${perWeek} tailored applications`,
            'Follow up on applications older than a week',
          ],
        },
        {
          title: 'Interviews (3)',
          weeks: 6,
          weight: 2,
          target_type: 'count',
          target_value: 3,
          current_source: { kind: 'job_applications', stage: 'interview' },
          estimated_weekly_quests: null,
          weekly: ['One mock interview', 'Prepare three project stories (STAR)'],
        },
      ],
      habits: [],
    };
  },
};
