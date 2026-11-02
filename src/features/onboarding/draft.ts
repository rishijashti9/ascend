import { GAME } from '@/config/game';
import type { Settings, Stat } from '@/core/db/types';
import type { ThemePreference } from '@/app/theme';
import type { OnboardingPayload } from '@/core/pipeline';
import {
  STARTER_DREAM,
  STARTER_HABITS,
  STARTER_MAIN_QUESTS,
  WAKE_HABIT_KEY,
  habitFieldsOf,
  wakeWording,
  type StarterHabit,
} from '@/data/starter';
import { editProblems } from '@/ui/habit/habitEdit';

/** Everything the five onboarding steps edit, kept in memory until "Begin". */
export interface Draft {
  name: string;
  wakeTime: string;
  habits: StarterHabit[];
  dream: { title: string; why: string };
  mainQuests: { title: string; stat: Stat }[];
  theme: ThemePreference;
  start: 'today' | 'tomorrow';
}

export function initialDraft(): Draft {
  return {
    name: 'Rishi',
    wakeTime: '05:00',
    habits: STARTER_HABITS.map((h) => ({ ...h })),
    dream: { ...STARTER_DREAM },
    mainQuests: STARTER_MAIN_QUESTS.map((m) => ({ ...m })),
    theme: 'system',
    start: 'today',
  };
}

type Timing = Pick<Settings, 'wake_window_min' | 'wake_late_cutoff'>;

/** The wake-up quest's wording follows the chosen wake time. */
export function withWakeWording(habit: StarterHabit, wakeTime: string, timing: Timing) {
  if (habit.key !== WAKE_HABIT_KEY) return habit;
  return { ...habit, ...wakeWording(wakeTime, timing.wake_window_min, timing.wake_late_cutoff) };
}

/** Problems with one quest, in plain words (empty = fine). */
export const questProblems = (h: StarterHabit): string[] => editProblems(h);

export const coreCount = (d: Draft) => d.habits.filter((h) => h.selected && h.core).length;
export const canAddCore = (d: Draft) => coreCount(d) < GAME.maxCoreHabits;

/** Why "Next" is blocked on each step, or null if the step is complete. */
export function stepProblem(d: Draft, step: number): string | null {
  if (step === 0 && !d.name.trim()) return 'Enter your name';
  if (step === 2) {
    const picked = d.habits.filter((h) => h.selected);
    if (picked.length === 0) return 'Pick at least one daily quest';
    const broken = picked.find((h) => questProblems(h).length > 0 || !h.title.trim());
    if (broken) return `Fix "${broken.title || 'Untitled'}" first`;
  }
  if (step === 3) {
    if (d.mainQuests.length > 0 && !d.dream.title.trim()) return 'Give your Dream a title';
    if (d.mainQuests.some((m) => !m.title.trim())) return 'Every Main Quest needs a title';
  }
  return null;
}

export function toPayload(d: Draft, timing: Timing): OnboardingPayload {
  const dreamTitle = d.dream.title.trim();
  return {
    name: d.name.trim(),
    wake_time: d.wakeTime,
    theme: d.theme,
    start: d.start,
    habits: d.habits
      .filter((h) => h.selected)
      .map((h) => habitFieldsOf(withWakeWording(h, d.wakeTime, timing))),
    dream: dreamTitle ? { title: dreamTitle, why: d.dream.why.trim() } : null,
    main_quests: dreamTitle ? d.mainQuests.map((m) => ({ ...m, title: m.title.trim() })) : [],
  };
}
