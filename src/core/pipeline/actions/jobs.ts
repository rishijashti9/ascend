import { z } from 'zod';
import { writeLearning } from '@/core/adaptive/record';
import type { JobApplication, JobStage, QuestInstance } from '@/core/db/types';
import { isDone } from '@/core/engine/progress';
import { addDays, weekStartOf } from '@/core/time';
import { appDayOf, getSettings } from '../helpers';
import { newBase, touch } from '../records';
import { defineAction, RuleError, type ActionContext } from '../registry';
import { QUEST_TABLES } from './questCommon';
import { insertQuest, questDefSchema, questInstanceId, setQuestArchived } from './questDefs';
import { completeQuest, logProgress, untickQuest } from './quests';

/**
 * Job application tracker (SPEC 6.5, 4.8). Logging an application (or reaching an interview)
 * gives INT XP through a quest — never separately from the log:
 * - an application adds 1 to today's open "apply" count quest if there is one;
 * - otherwise it creates and completes an automatic Easy side quest "Applied: <company>";
 * - an interview always gets its own Normal side quest "Interview: <company>".
 * The automatic quests have fixed ids (`job:<id>:applied` / `job:<id>:interview`), so a double
 * tap or a second device never gives XP twice. Moving a job back (or deleting it) on the same
 * day takes back its automatic quest — the usual same-day correction.
 */
const TABLES = [...QUEST_TABLES, 'job_applications', 'milestones', 'main_quests'] as const;
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const text = (max: number) => z.string().trim().max(max).nullable();
export const JOB_STAGES = [
  'saved',
  'applied',
  'assessment',
  'interview',
  'offer',
  'rejected',
  'ghosted',
] as const satisfies readonly JobStage[];
const stage = z.enum(JOB_STAGES);

/** Days after applying until the follow-up reminder (SPEC 6.5). */
export const FOLLOW_UP_DAYS = 7;
/** Stages where the search for this job is over: no follow-up any more. */
export const CLOSED_STAGES: readonly JobStage[] = ['offer', 'rejected', 'ghosted'];
const ORDER: Record<JobStage, number> = {
  saved: 0,
  applied: 1,
  assessment: 2,
  interview: 3,
  offer: 4,
  rejected: 4,
  ghosted: 4,
};

const fields = {
  company: z.string().trim().min(1, 'a company is required').max(80),
  role: z.string().trim().min(1, 'a role is required').max(100),
  link: text(500),
  source: text(60),
  salary_range: text(60),
  notes: text(2000),
  follow_up_at: day.nullable(),
  applied_at: day.nullable(),
};

function checkLink(link: string | null) {
  if (link && !/^https?:\/\/\S+$/i.test(link)) {
    throw new RuleError('A link must start with http:// or https://');
  }
}

/** Empty text means "nothing". */
function clean<T extends Record<string, unknown>>(values: T): T {
  return Object.fromEntries(
    Object.entries(values).map(([k, v]) => [k, typeof v === 'string' && v === '' ? null : v]),
  ) as T;
}

export const applicationQuestId = (jobId: string) => `job:${jobId}:applied`;
export const interviewQuestId = (jobId: string) => `job:${jobId}:interview`;

/** A quest that counts applications: measured as a count, with "apply/application" in its title. */
export function isApplyQuest(i: Pick<QuestInstance, 'measure_snapshot' | 'title_snapshot'>) {
  return (
    i.measure_snapshot === 'count' && /\b(apply|applying|applications?)\b/i.test(i.title_snapshot)
  );
}

/** Today's open "apply" count quest (daily first, then this week's), if any. */
async function openApplyQuest(ctx: ActionContext, today: string) {
  const settings = await getSettings(ctx.db);
  const week = weekStartOf(today, settings.week_start);
  const candidates = (await ctx.db.quest_instances.where('day').anyOf(today, week).toArray())
    .filter(
      (i) =>
        i.deleted_at === null &&
        isApplyQuest(i) &&
        i.status !== 'done_full' &&
        i.status !== 'missed' &&
        i.status !== 'skipped' &&
        (i.source_type === 'habit' ? i.day === today : true),
    )
    .sort((a, b) => (a.source_type === b.source_type ? 0 : a.source_type === 'habit' ? -1 : 1));
  for (const c of candidates) {
    if (c.source_type === 'habit') return c;
    const quest = await ctx.db.quests.get(c.source_id);
    if (quest?.type === 'weekly' && quest.status === 'active' && quest.week_start === week) {
      return c;
    }
  }
  return undefined;
}

/** Creates (or brings back) a job's automatic side quest and completes it in full. */
async function completeAutoQuest(
  ctx: ActionContext,
  questId: string,
  title: string,
  difficulty: 'easy' | 'normal',
) {
  const jobCtx: ActionContext = { ...ctx, source: 'job_log' };
  let quest = await ctx.db.quests.get(questId);
  if (!quest) {
    quest = await insertQuest(
      jobCtx,
      questDefSchema.parse({ type: 'side', title, stat: 'INT', difficulty }),
      questId,
    );
  }
  const instance = await ctx.db.quest_instances.get(questInstanceId(quest));
  if (instance && isDone(instance.status)) return;
  if (quest.status === 'archived') {
    await setQuestArchived.run(jobCtx, { id: questId, archived: false });
  }
  await completeQuest.run(jobCtx, { instanceId: questInstanceId(quest), version: 'full' });
}

/** Takes back an automatic side quest finished today (same-day correction); later it stays. */
async function takeBackAutoQuest(ctx: ActionContext, questId: string, today: string) {
  const quest = await ctx.db.quests.get(questId);
  if (!quest || quest.deleted_at) return;
  const instance = await ctx.db.quest_instances.get(questInstanceId(quest));
  if (!instance || !isDone(instance.status) || !instance.completed_at) return;
  if ((await appDayOf(ctx.db, instance.completed_at)) !== today) return;
  await untickQuest.run(ctx, { instanceId: instance.id });
  await setQuestArchived.run(ctx, { id: questId, archived: true });
}

/** XP for reaching "applied" / "interview" — once per job. Returns the job with its quest link. */
async function credit(ctx: ActionContext, job: JobApplication, from: JobStage | null) {
  const today = await appDayOf(ctx.db, ctx.occurredAt);
  let next = job;
  const reached = (s: JobStage) =>
    ORDER[job.stage] >= ORDER[s] &&
    !(from !== null && ORDER[from] >= ORDER[s]) &&
    !(job.stage === 'rejected' || job.stage === 'ghosted');
  if (reached('applied')) {
    const autoId = applicationQuestId(job.id);
    if (job.linked_quest_instance_id === null) {
      const counted = await openApplyQuest(ctx, today);
      if (counted) {
        await logProgress.run(
          { ...ctx, source: 'job_log' },
          { instanceId: counted.id, amount: 1, source: 'job_log', refId: job.id },
        );
        next = { ...next, linked_quest_instance_id: counted.id };
      } else {
        await completeAutoQuest(ctx, autoId, `Applied: ${job.company}`, 'easy');
        next = { ...next, linked_quest_instance_id: autoId };
      }
    } else if (job.linked_quest_instance_id === autoId) {
      await completeAutoQuest(ctx, autoId, `Applied: ${job.company}`, 'easy');
    }
  }
  if (reached('interview')) {
    await completeAutoQuest(ctx, interviewQuestId(job.id), `Interview: ${job.company}`, 'normal');
  }
  return next;
}

async function getJob(ctx: ActionContext, id: string): Promise<JobApplication> {
  const job = await ctx.db.job_applications.get(id);
  if (!job || job.deleted_at) throw new RuleError('Application not found');
  return job;
}

export const createJob = defineAction({
  type: 'job.create',
  schema: z
    .object({
      ...fields,
      link: fields.link.default(null),
      source: fields.source.default(null),
      salary_range: fields.salary_range.default(null),
      notes: fields.notes.default(null),
      follow_up_at: fields.follow_up_at.default(null),
      applied_at: fields.applied_at.default(null),
      stage: z.enum(['saved', 'applied']).default('applied'),
    })
    .strict(),
  tables: [...TABLES],
  async run(ctx, raw) {
    const p = clean(raw);
    checkLink(p.link);
    const today = await appDayOf(ctx.db, ctx.occurredAt);
    const applied = p.stage === 'applied';
    const appliedAt = applied ? (p.applied_at ?? today) : null;
    if (appliedAt && appliedAt > today) throw new RuleError('That day hasn’t happened yet');
    const job: JobApplication = {
      ...newBase(undefined, ctx.processedAt),
      company: p.company,
      role: p.role,
      link: p.link,
      source: p.source,
      applied_at: appliedAt,
      stage: p.stage,
      stage_history: [{ stage: p.stage, at: ctx.occurredAt }],
      salary_range: p.salary_range,
      notes: p.notes,
      follow_up_at: p.follow_up_at ?? (appliedAt ? addDays(appliedAt, FOLLOW_UP_DAYS) : null),
      linked_quest_instance_id: null,
    };
    await ctx.db.job_applications.add(job);
    const credited = await credit(ctx, job, null);
    if (credited !== job) await ctx.db.job_applications.put(credited);
    ctx.emit({ type: 'JobChanged', payload: { jobId: job.id, change: 'created' } });
    return credited;
  },
});

export const updateJob = defineAction({
  type: 'job.update',
  schema: z
    .object({ id: z.string().min(1), changes: z.object(fields).partial().strict() })
    .strict()
    .refine((p) => Object.keys(p.changes).length > 0, 'nothing to change'),
  tables: [...TABLES],
  async run(ctx, { id, changes: raw }) {
    const current = await getJob(ctx, id);
    const changes = clean(raw);
    if (changes.link !== undefined) checkLink(changes.link);
    const today = await appDayOf(ctx.db, ctx.occurredAt);
    if (changes.applied_at && changes.applied_at > today) {
      throw new RuleError('That day hasn’t happened yet');
    }
    const next: JobApplication = { ...current, ...changes, ...touch(ctx.processedAt) };
    await ctx.db.job_applications.put(next);
    ctx.emit({ type: 'JobChanged', payload: { jobId: id, change: 'updated' } });
    return next;
  },
});

/** Move an application along the pipeline (or back, to correct a mistake). */
export const setJobStage = defineAction({
  type: 'job.setStage',
  schema: z.object({ id: z.string().min(1), stage }).strict(),
  tables: [...TABLES],
  async run(ctx, { id, stage: to }) {
    const current = await getJob(ctx, id);
    if (current.stage === to) return current;
    const today = await appDayOf(ctx.db, ctx.occurredAt);
    const appliedAt = current.applied_at ?? (to !== 'saved' && to !== 'ghosted' ? today : null);
    let follow = current.follow_up_at;
    if (CLOSED_STAGES.includes(to)) follow = null;
    else if (to === 'saved') follow = null;
    else if (current.stage === 'saved' && follow === null && appliedAt) {
      follow = addDays(appliedAt, FOLLOW_UP_DAYS);
    }
    let next: JobApplication = {
      ...current,
      stage: to,
      stage_history: [...current.stage_history, { stage: to, at: ctx.occurredAt }],
      applied_at: to === 'saved' ? null : appliedAt,
      follow_up_at: follow,
      ...touch(ctx.processedAt),
    };
    // Back before a stage on the same day → its automatic quest is taken back.
    if (ORDER[to] < ORDER.interview) await takeBackAutoQuest(ctx, interviewQuestId(id), today);
    if (to === 'saved') await takeBackAutoQuest(ctx, applicationQuestId(id), today);
    next = await credit(ctx, next, current.stage);
    await ctx.db.job_applications.put(next);
    ctx.emit({ type: 'JobChanged', payload: { jobId: id, change: 'stage' } });
    return next;
  },
});

/** "Followed up": remind again in a week, or stop reminding for this application. */
export const followedUp = defineAction({
  type: 'job.followedUp',
  schema: z.object({ id: z.string().min(1), next: z.enum(['week', 'none']) }).strict(),
  tables: [...TABLES],
  async run(ctx, { id, next }) {
    const current = await getJob(ctx, id);
    const today = await appDayOf(ctx.db, ctx.occurredAt);
    const updated: JobApplication = {
      ...current,
      follow_up_at: next === 'week' ? addDays(today, FOLLOW_UP_DAYS) : null,
      ...touch(ctx.processedAt),
    };
    await ctx.db.job_applications.put(updated);
    ctx.emit({ type: 'JobChanged', payload: { jobId: id, change: 'updated' } });
    return updated;
  },
});

/** Meta key hiding one kind of job suggestion until a day (this device only). */
export const jobSuggestionSnoozeKey = (kind: string) => `job_suggestion_snooze:${kind}`;
export const JOB_SUGGESTION_SNOOZE_DAYS = 14;

/** "Not now" on a job-stats suggestion: hidden for two weeks. */
export const snoozeJobSuggestion = defineAction({
  type: 'job.snoozeSuggestion',
  schema: z.object({ kind: z.enum(['interview', 'assessment', 'response']) }).strict(),
  tables: ['meta', 'settings', 'learning_events'],
  async run(ctx, { kind }) {
    await writeLearning(ctx, { kind: 'suggestion', type: `job_${kind}`, outcome: 'rejected' });
    const today = await appDayOf(ctx.db, ctx.occurredAt);
    const until = addDays(today, JOB_SUGGESTION_SNOOZE_DAYS);
    await ctx.db.meta.put({ id: jobSuggestionSnoozeKey(kind), value: until });
    ctx.emit({ type: 'JobChanged', payload: { jobId: '', change: 'updated' } });
    return until;
  },
});

/** Delete an application (soft delete). Same day, its automatic quests are taken back. */
export const deleteJob = defineAction({
  type: 'job.delete',
  schema: z.object({ id: z.string().min(1) }).strict(),
  tables: [...TABLES],
  async run(ctx, { id }) {
    const current = await getJob(ctx, id);
    const today = await appDayOf(ctx.db, ctx.occurredAt);
    await takeBackAutoQuest(ctx, interviewQuestId(id), today);
    await takeBackAutoQuest(ctx, applicationQuestId(id), today);
    await ctx.db.job_applications.put({
      ...current,
      deleted_at: ctx.processedAt,
      ...touch(ctx.processedAt),
    });
    ctx.emit({ type: 'JobChanged', payload: { jobId: id, change: 'deleted' } });
    return true;
  },
});
