import type { Stat } from '@/core/db/types';
import {
  STARTER_DREAM,
  STARTER_HABITS,
  STARTER_MAIN_QUESTS,
  WAKE_HABIT_KEY,
  type StarterHabit,
} from './starter';

/**
 * Onboarding starter templates by goal type (SPEC 6.7 rules: works for any user). Each is a
 * set of daily quests (full + minimum versions, up to 3 core) plus a first dream and main
 * quests — all editable before "Begin". Rishi's own set is one template among them.
 */
export interface StarterTemplate {
  id: string;
  label: string;
  description: string;
  habits: StarterHabit[];
  dream: { title: string; why: string };
  mainQuests: { title: string; stat: Stat }[];
}

const byKey = new Map(STARTER_HABITS.map((h) => [h.key, h]));
/** A starter habit by key, with overrides (core / selected). */
const pick = (key: string, over: Partial<StarterHabit> = {}): StarterHabit => {
  const h = byKey.get(key);
  if (!h) throw new Error(`unknown starter habit ${key}`);
  return { ...h, ...over };
};
const minutes = (
  key: string,
  title: string,
  stat: Stat,
  target: number,
  min: number,
  over: Partial<StarterHabit> = {},
): StarterHabit => ({
  key,
  title,
  stat,
  difficulty: target >= 90 ? 'hard' : 'normal',
  measure: 'minutes',
  target_value: target,
  min_value: min,
  full_version: '',
  min_version: '',
  core: false,
  auto_source: 'none',
  selected: true,
  ...over,
});
const checkHabit = (
  key: string,
  title: string,
  stat: Stat,
  full: string,
  min: string,
  over: Partial<StarterHabit> = {},
): StarterHabit => ({
  key,
  title,
  stat,
  difficulty: 'easy',
  measure: 'check',
  target_value: null,
  min_value: null,
  full_version: full,
  min_version: min,
  core: false,
  auto_source: 'none',
  selected: true,
  ...over,
});

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: 'ai-robotics',
    label: 'AI, robotics & game dev',
    description: 'Rishi’s set: deep study blocks, training, sleep and calm habits.',
    habits: STARTER_HABITS.map((h) => ({ ...h })),
    dream: { ...STARTER_DREAM },
    mainQuests: STARTER_MAIN_QUESTS.map((m) => ({ ...m })),
  },
  {
    id: 'fitness',
    label: 'Fitness',
    description: 'Train, move, sleep and eat well — built up gradually.',
    habits: [
      pick(WAKE_HABIT_KEY, { core: true }),
      pick('workout', { core: true }),
      pick('walk', { core: true }),
      pick('sleep'),
      checkHabit(
        'protein',
        'Protein at every main meal',
        'STR',
        'Dal, chana, paneer, eggs or curd at each main meal',
        'Protein at one meal',
      ),
      pick('stretch', { selected: true }),
    ],
    dream: {
      title: 'Be strong and healthy for life',
      why: 'Energy for everything else I care about.',
    },
    mainQuests: [
      { title: 'A steady training habit', stat: 'STR' },
      { title: 'Sleep 7+ hours most nights', stat: 'STR' },
    ],
  },
  {
    id: 'study',
    label: 'Study & exams',
    description: 'Focused study blocks, spaced review and enough sleep to remember it.',
    habits: [
      pick(WAKE_HABIT_KEY, { core: true }),
      minutes('study-block', 'Focused study (phone-free)', 'INT', 120, 25, { core: true }),
      minutes('review', 'Review flashcards', 'INT', 15, 5, { core: true }),
      pick('sleep'),
      pick('walk'),
      pick('phone-free-morning', { selected: true }),
    ],
    dream: { title: 'Pass my exams with confidence', why: 'The next step I’m working towards.' },
    mainQuests: [{ title: 'Exam preparation', stat: 'INT' }],
  },
  {
    id: 'career',
    label: 'Career & skills',
    description: 'Practise a skill daily, build real projects, keep body and mind going.',
    habits: [
      pick(WAKE_HABIT_KEY, { core: true }),
      minutes('skill-practice', 'Skill practice (phone-free)', 'INT', 90, 20, { core: true }),
      minutes('project', 'Build my project', 'INT', 45, 10),
      pick('workout', { core: true }),
      pick('read', { selected: true }),
      pick('sleep'),
    ],
    dream: { title: 'Build a career I’m proud of', why: 'Work that uses what I’m good at.' },
    mainQuests: [
      { title: 'Core skills for my target role', stat: 'INT' },
      { title: 'A portfolio project', stat: 'INT' },
    ],
  },
  {
    id: 'discipline',
    label: 'Discipline & calm',
    description: 'Wake on time, protect your attention, reflect and rest.',
    habits: [
      pick(WAKE_HABIT_KEY, { core: true }),
      pick('phone-free-morning', { selected: true, core: true }),
      pick('journal', { core: true }),
      pick('meditate'),
      pick('workout', { core: false }),
      pick('sleep'),
    ],
    dream: {
      title: 'Keep the promises I make to myself',
      why: 'Calm, focused and in charge of my days.',
    },
    mainQuests: [
      { title: 'A morning routine that sticks', stat: 'WIL' },
      { title: 'Phone-free focus', stat: 'WIL' },
    ],
  },
];

export const DEFAULT_TEMPLATE = 'ai-robotics';
