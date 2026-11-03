import { z } from 'zod';

/**
 * Growth Compass knowledge pack (SPEC 6.7 B): versioned, sourced data files — careers, skills,
 * learning roadmaps and health guidelines. Every entry names its sources; changeable facts
 * (deadlines, fees, requirements, processing times) carry `checkOfficial` with the link.
 * Adding a career, skill or roadmap is one entry in a data file. Validated in tests.
 */
const id = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'ids are lowercase-with-dashes');
const url = z.string().url().startsWith('https://');

export const sourceSchema = z
  .object({
    id,
    title: z.string().min(3),
    publisher: z.string().min(2),
    url,
    /** e.g. "CC BY 4.0" — shown with the attribution. */
    license: z.string().optional(),
    /** Year (and month) the content was checked. */
    checked: z.string().regex(/^\d{4}(-\d{2})?$/),
  })
  .strict();

export const RIASEC = ['R', 'I', 'A', 'S', 'E', 'C'] as const;
export type Riasec = (typeof RIASEC)[number];

export const FIELDS = [
  'tech',
  'engineering',
  'science',
  'health',
  'business',
  'creative',
  'trades',
  'education',
  'public',
] as const;
export type CareerField = (typeof FIELDS)[number];

export const careerSchema = z
  .object({
    id,
    title: z.string().min(2),
    field: z.enum(FIELDS),
    /** Holland code, strongest first (O*NET interest profile), e.g. "IRC". */
    riasec: z.string().regex(/^[RIASEC]{1,3}$/),
    summary: z.string().min(20).max(300),
    /** Skills it needs, with importance 1 (useful) – 3 (core). */
    skills: z.array(z.object({ id, importance: z.number().int().min(1).max(3) }).strict()).min(2),
    /** Typical entry route, in words. */
    entry: z.string().min(10),
    /** O*NET-SOC code (links to O*NET OnLine). */
    onet: z
      .string()
      .regex(/^\d{2}-\d{4}\.\d{2}$/)
      .optional(),
    /** ISCO-08 unit group (ESCO occupations are grouped by it). */
    isco: z
      .string()
      .regex(/^\d{4}$/)
      .optional(),
    /** Detailed entry (deep skill graph + roadmap), e.g. Rishi's path. */
    deep: z.boolean().default(false),
    sources: z.array(id).min(1),
  })
  .strict();

export const skillSchema = z
  .object({
    id,
    name: z.string().min(1),
    /** Learn these first. */
    prereqs: z.array(id).default([]),
    /** Typical focused hours to a solid working level. */
    hours: z.number().int().min(5).max(2000),
    /** Names in the user's skill tree that count as this skill (matched case-insensitively). */
    matches: z.array(z.string()).default([]),
    /** Official / trusted places to learn it. */
    learn: z.array(z.object({ title: z.string(), url }).strict()).default([]),
    sources: z.array(id).default([]),
  })
  .strict();

const stepSchema = z
  .object({
    title: z.string().min(2),
    /** Typical duration in weeks. */
    weeks: z.number().min(0).max(104),
    detail: z.string().min(5),
    /** Skill this step builds (links roadmap steps to the skill graph). */
    skill: id.optional(),
    /** Changeable facts in this step → "Check the official site" with this link. */
    checkOfficial: url.optional(),
  })
  .strict();

export const roadmapSchema = z
  .object({
    id,
    title: z.string().min(3),
    kind: z.enum(['skill', 'exam', 'process', 'study']),
    summary: z.string().min(10),
    steps: z.array(stepSchema).min(2),
    sources: z.array(id).min(1),
  })
  .strict();

export const guidelineSchema = z
  .object({
    id,
    topic: z.enum(['activity', 'sleep', 'diet', 'recovery', 'mental']),
    title: z.string().min(3),
    /** Who it applies to, e.g. "Adults 18–64". */
    audience: z.string().min(3),
    text: z.string().min(10),
    /** Numbers the gap analysis compares against (e.g. moderate_min_week: 150). */
    numbers: z.record(z.string(), z.number()).default({}),
    sources: z.array(id).min(1),
  })
  .strict();

export const helplineSchema = z
  .object({
    country: z.string().length(2),
    name: z.string(),
    phones: z.array(z.string().min(3)).min(1),
    hours: z.string(),
    url,
    /** When the number was last verified against the official site. */
    verified: z.string().regex(/^\d{4}-\d{2}$/),
    sources: z.array(id).min(1),
  })
  .strict();

export const packSchema = z
  .object({
    version: z.string().regex(/^\d{4}\.\d{2}\.\d+$/),
    sources: z.array(sourceSchema),
    careers: z.array(careerSchema),
    skills: z.array(skillSchema),
    roadmaps: z.array(roadmapSchema),
    guidelines: z.array(guidelineSchema),
    helplines: z.array(helplineSchema),
  })
  .strict();

export type Source = z.infer<typeof sourceSchema>;
export type Career = z.infer<typeof careerSchema>;
export type CompassSkill = z.infer<typeof skillSchema>;
export type Roadmap = z.infer<typeof roadmapSchema>;
export type RoadmapStep = Roadmap['steps'][number];
export type Guideline = z.infer<typeof guidelineSchema>;
export type Helpline = z.infer<typeof helplineSchema>;
export type Pack = z.infer<typeof packSchema>;
export type PackInput = z.input<typeof packSchema>;
