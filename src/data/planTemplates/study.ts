import type { PlanMilestone, PlanTemplate } from '@/core/planner/types';
import { DAYS, LEVEL, MINUTES, OBSTACLE, minutesHabit, num, obstacleWeekly, str } from './shared';

const manual = (
  title: string,
  weeks: number,
  weight: 1 | 2 | 3,
  estimate: number,
  weekly: string[],
): PlanMilestone => ({
  title,
  weeks,
  weight,
  target_type: 'manual',
  target_value: null,
  current_source: null,
  estimated_weekly_quests: estimate,
  weekly,
});

const counted = (
  title: string,
  weeks: number,
  weight: 1 | 2 | 3,
  target: number,
  weekly: string[],
): PlanMilestone => ({
  title,
  weeks,
  weight,
  target_type: 'count',
  target_value: target,
  current_source: { kind: 'linked_quests' },
  estimated_weekly_quests: null,
  weekly,
});

/** Exam preparation: IELTS, GRE or another test. */
export const examPrep: PlanTemplate = {
  id: 'exam',
  name: 'Exam preparation',
  keywords: ['ielts', 'gre', 'toefl', 'gmat', 'exam', 'test', 'band', 'score', 'testdaf'],
  stat: 'INT',
  questions: [
    {
      id: 'exam',
      label: 'Which exam?',
      kind: 'chips',
      options: [
        { value: 'IELTS', label: 'IELTS' },
        { value: 'GRE', label: 'GRE' },
        { value: 'TOEFL', label: 'TOEFL' },
        { value: 'Other', label: 'Other' },
      ],
      default: 'IELTS',
    },
    { id: 'target_score', label: 'Target score (optional)', kind: 'text', optional: true },
    LEVEL,
    MINUTES,
    DAYS,
  ],
  build(a) {
    const exam = str(a, 'exam', 'IELTS');
    const advanced = str(a, 'level', 'beginner') === 'advanced';
    const name = exam === 'Other' ? 'exam' : exam;
    return {
      weeklyPerWeek: 3,
      milestones: [
        manual(`${name}: diagnostic test and study plan`, 1, 1, 2, [
          `Take a full ${name} diagnostic test`,
          'List your three weakest sections',
          ...obstacleWeekly(a),
        ]),
        manual(`${name}: core skills practice`, advanced ? 4 : 7, 3, advanced ? 8 : 14, [
          'Two timed section drills',
          'Review every mistake from this week',
          'Learn 50 new words / formulas',
          'One writing task, checked against the band descriptors',
        ]),
        counted(`${name}: full mock tests`, 4, 2, 6, [
          `Full timed ${name} mock test`,
          'Review the mock test and log weak points',
        ]),
        manual(`${name}: final review and exam day`, 1, 1, 3, [
          'Light review of notes',
          'Check exam logistics (ID, route, time)',
        ]),
      ],
      habits: [minutesHabit(`${name} study`, 'INT', num(a, 'minutes_per_day', 60), a)],
    };
  },
};

/** University application, with the German route (APS, uni-assist, blocked account). */
export const universityApplication: PlanTemplate = {
  id: 'university',
  name: 'University application',
  keywords: [
    'ms',
    'msc',
    'master',
    'masters',
    'university',
    'admission',
    'aps',
    'germany',
    'uni-assist',
    'phd',
  ],
  stat: 'INT',
  questions: [
    {
      id: 'intake',
      label: 'Which intake?',
      kind: 'chips',
      options: [
        { value: 'winter', label: 'Winter semester' },
        { value: 'summer', label: 'Summer semester' },
        { value: 'unsure', label: 'Not sure yet' },
      ],
      default: 'winter',
    },
    {
      id: 'aps_status',
      label: 'APS certificate',
      kind: 'chips',
      options: [
        { value: 'not_started', label: 'Not started' },
        { value: 'in_progress', label: 'Applied / waiting' },
        { value: 'done', label: 'Have it' },
      ],
      default: 'not_started',
    },
    {
      id: 'language_test',
      label: 'IELTS / TOEFL',
      kind: 'chips',
      options: [
        { value: 'not_taken', label: 'Not taken' },
        { value: 'booked', label: 'Booked' },
        { value: 'done', label: 'Have the score' },
      ],
      default: 'not_taken',
    },
    {
      id: 'universities',
      label: 'How many universities?',
      kind: 'slider',
      min: 1,
      max: 12,
      step: 1,
      default: 5,
    },
    MINUTES,
  ],
  build(a) {
    const universities = num(a, 'universities', 5);
    const milestones: PlanMilestone[] = [
      manual('Shortlist universities and check requirements', 2, 1, 3, [
        'Compare 5 programs (DAAD database): deadlines, ECTS and language rules',
        'Write each program’s requirements into one sheet',
        ...obstacleWeekly(a),
      ]),
    ];
    if (str(a, 'aps_status', 'not_started') !== 'done') {
      milestones.push(
        manual('APS certificate', 6, 2, 4, [
          'Collect transcripts and degree documents for APS',
          'Submit the APS application and pay the fee',
          'Prepare for the APS interview / check its status',
        ]),
      );
    }
    if (str(a, 'language_test', 'not_taken') !== 'done') {
      milestones.push(
        manual('Language test score', 8, 2, 8, [
          'Book the IELTS / TOEFL date',
          'One full practice test',
        ]),
      );
    }
    milestones.push(
      manual('Application documents (CV, SOP, LORs)', 4, 2, 6, [
        'Draft the statement of purpose',
        'Update the CV in Europass / academic format',
        'Ask two professors for recommendation letters',
        'Get the SOP reviewed and revise it',
      ]),
      counted(`Applications submitted (${universities})`, 4, 3, universities, [
        'Submit one application (uni-assist or direct)',
        'Double-check one application’s documents',
      ]),
      manual('Visa and finances (blocked account, insurance)', 6, 2, 4, [
        'Open the blocked account',
        'Book the visa appointment',
        'Arrange health insurance',
      ]),
    );
    return {
      weeklyPerWeek: 3,
      milestones,
      habits: [
        minutesHabit('Application work', 'INT', Math.min(num(a, 'minutes_per_day', 45), 90), a),
      ],
    };
  },
};

/** Learning a skill (the default when nothing else matches). */
export const learnSkill: PlanTemplate = {
  id: 'skill',
  name: 'Learn a skill',
  keywords: [
    'learn',
    'skill',
    'skills',
    'course',
    'foundations',
    'core',
    'basics',
    'python',
    'c++',
    'ros',
    'unreal',
    'unity',
    'math',
    'ml',
    'robotics',
    'german',
  ],
  stat: 'INT',
  questions: [LEVEL, MINUTES, DAYS, OBSTACLE],
  build(a, ctx) {
    const level = str(a, 'level', 'beginner');
    const topic = ctx.goalTitle;
    const milestones: PlanMilestone[] = [];
    if (level === 'beginner') {
      milestones.push(
        manual(`${topic}: foundations`, 4, 2, 8, [
          'Finish one structured lesson block (course / book chapter)',
          'Write a one-page summary of what you learned',
          'Do the exercises without looking at solutions',
          ...obstacleWeekly(a),
        ]),
      );
    }
    milestones.push(
      manual(`${topic}: guided practice`, 4, 2, 8, [
        'Complete two practice exercises end to end',
        'Rebuild one tutorial example from memory',
        'Explain one concept out loud or in writing',
      ]),
      manual(`${topic}: first small project`, 4, 3, 6, [
        'Define a small project with a clear “done”',
        'Build the core of the project',
        'Fix, test and write a short README',
      ]),
      manual(`${topic}: deeper topics`, 6, 2, 10, [
        'Study one advanced topic and take notes',
        'Read one paper / long article and summarise it',
        'Apply the new topic in code',
      ]),
    );
    return {
      weeklyPerWeek: 3,
      milestones,
      habits: [minutesHabit(`${topic} practice`, 'INT', num(a, 'minutes_per_day', 60), a)],
    };
  },
};
