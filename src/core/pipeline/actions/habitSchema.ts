import { z } from 'zod';

/** Validation for habit fields (SPEC 4.8 measurable quests, section 10 habits). */

export const statSchema = z.enum(['STR', 'INT', 'WIL']);
export const difficultySchema = z.enum(['easy', 'normal', 'hard', 'epic']);
export const measureSchema = z.enum(['check', 'minutes', 'count', 'steps', 'sleep_hours']);
export const autoSourceSchema = z.enum([
  'none',
  'steps',
  'sleep',
  'workout',
  'wake_checkin',
  'screen_time',
]);
const weekday = z.number().int().min(0).max(6);

export const habitFieldsSchema = z
  .object({
    title: z.string().trim().min(1, 'title is required').max(80),
    stat: statSchema,
    difficulty: difficultySchema,
    schedule: z
      .array(weekday)
      .min(1, 'pick at least one day')
      .refine((days) => new Set(days).size === days.length, 'days repeat'),
    full_version: z.string().trim().max(120),
    min_version: z.string().trim().max(120),
    measure: measureSchema,
    target_value: z.number().positive().nullable(),
    min_value: z.number().positive().nullable(),
    core: z.boolean(),
    auto_source: autoSourceSchema,
    linked_goal_type: z.enum(['dream', 'main_quest', 'milestone']).nullable(),
    linked_goal_id: z.string().min(1).nullable(),
    skill_ids: z.array(z.string().min(1)).max(20),
    planned_by: z.enum(['me', 'rules', 'ai']),
  })
  .strict();

export type HabitFields = z.infer<typeof habitFieldsSchema>;

/** Cross-field rules, applied to a full (merged) habit. Returns problems, empty if valid. */
export function habitProblems(h: HabitFields): string[] {
  const problems: string[] = [];
  if (h.measure === 'check') {
    if (h.target_value !== null || h.min_value !== null)
      problems.push('check quests have no numeric target');
    if (!h.full_version) problems.push('describe the full version');
    if (!h.min_version) problems.push('describe the minimum version');
  } else {
    if (h.target_value === null || h.min_value === null)
      problems.push('numeric quests need a target and a minimum');
    else if (h.min_value > h.target_value) problems.push('minimum must not exceed the target');
    if (h.measure !== 'sleep_hours') {
      const ints = [h.target_value, h.min_value].filter((v): v is number => v !== null);
      if (ints.some((v) => !Number.isInteger(v)))
        problems.push('target and minimum must be whole numbers');
    }
  }
  if ((h.linked_goal_type === null) !== (h.linked_goal_id === null))
    problems.push('goal link needs both a type and an id');
  return problems;
}

/** Defaults so callers (onboarding, planner, quick add) only send what matters. */
export const HABIT_DEFAULTS = {
  schedule: [0, 1, 2, 3, 4, 5, 6],
  core: false,
  auto_source: 'none',
  linked_goal_type: null,
  linked_goal_id: null,
  skill_ids: [],
  planned_by: 'me',
  target_value: null,
  min_value: null,
  full_version: '',
  min_version: '',
} as const satisfies Partial<HabitFields>;

export const createHabitSchema = habitFieldsSchema
  .partial({
    schedule: true,
    core: true,
    auto_source: true,
    linked_goal_type: true,
    linked_goal_id: true,
    skill_ids: true,
    planned_by: true,
    target_value: true,
    min_value: true,
    full_version: true,
    min_version: true,
  })
  .extend({ id: z.uuid().optional() });

export const updateHabitSchema = z
  .object({ id: z.string().min(1), changes: habitFieldsSchema.partial().strict() })
  .strict()
  .refine((p) => Object.keys(p.changes).length > 0, 'nothing to change');
