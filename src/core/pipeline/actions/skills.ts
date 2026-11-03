import { z } from 'zod';
import type { Skill, SkillEvidence } from '@/core/db/types';
import { SKILL_SEED, seedSkillId } from '@/data/skills';
import { appDayOf } from '../helpers';
import { newBase, touch } from '../records';
import { defineAction, RuleError, type ActionContext } from '../registry';

/**
 * Skill tree (SPEC 6.5, task 9.1): branches and skills are data Rishi can edit; levels are
 * computed (engine/skills.ts). Stored evidence is only finished projects — focus sessions and
 * quests count through their own records.
 */
const TABLES = ['skills', 'skill_evidence', 'settings'] as const;
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const name = z.string().trim().min(1, 'a name is required').max(60);
const track = z.enum(['ai_robotics', 'games', 'other']);
const level = z.number().int().min(0).max(5);

/**
 * Seeded records carry the lowest possible clock, so any real edit on any device wins over a
 * fresh seed, and a seed is never pushed over someone's changes.
 */
export const SEED_HLC = '000000000000000-0000-seed';

/**
 * Adds every starter skill this device doesn't have yet (deleted ones stay deleted). Safe to
 * run at every start: after a restore from an older backup the roadmap simply comes back.
 */
export const seedSkills = defineAction({
  type: 'skills.seed',
  schema: z.object({}).strict(),
  tables: ['skills'],
  async run(ctx) {
    const wanted: Skill[] = [];
    let order = 0;
    for (const b of SKILL_SEED) {
      for (const skillName of b.skills) {
        wanted.push({
          ...newBase(seedSkillId(b.branch, skillName), ctx.processedAt),
          hlc: SEED_HLC,
          branch: b.branch,
          track: b.track,
          name: skillName,
          parent_id: null,
          order: order++,
          manual_level_override: null,
          status: 'active',
        });
      }
    }
    const existing = await ctx.db.skills.bulkGet(wanted.map((s) => s.id));
    const missing = wanted.filter((_, i) => existing[i] === undefined);
    if (missing.length === 0) return 0;
    await ctx.db.skills.bulkAdd(missing);
    ctx.emit({ type: 'SkillChanged', payload: { skillId: null } });
    return missing.length;
  },
});

async function liveSkills(ctx: ActionContext): Promise<Skill[]> {
  return (await ctx.db.skills.toArray()).filter((s) => s.deleted_at === null);
}

async function getSkill(ctx: ActionContext, id: string): Promise<Skill> {
  const skill = await ctx.db.skills.get(id);
  if (!skill || skill.deleted_at) throw new RuleError('Skill not found');
  return skill;
}

async function checkParent(
  ctx: ActionContext,
  skill: Pick<Skill, 'id' | 'branch'>,
  parentId: string | null,
) {
  if (parentId === null) return;
  if (parentId === skill.id) throw new RuleError('A skill can’t be its own parent');
  const all = await liveSkills(ctx);
  const byId = new Map(all.map((s) => [s.id, s]));
  const parent = byId.get(parentId);
  if (!parent) throw new RuleError('The parent skill no longer exists');
  if (parent.branch !== skill.branch) throw new RuleError('The parent must be in the same branch');
  // No loops: walking up from the parent must never reach this skill.
  for (let p: Skill | undefined = parent; p; p = p.parent_id ? byId.get(p.parent_id) : undefined) {
    if (p.id === skill.id) throw new RuleError('That would put the skill under itself');
  }
}

export const createSkill = defineAction({
  type: 'skill.create',
  schema: z
    .object({
      branch: name,
      name,
      /** Only used for a new branch; an existing branch keeps its own track. */
      track: track.default('other'),
      parent_id: z.string().min(1).nullable().default(null),
    })
    .strict(),
  tables: [...TABLES],
  async run(ctx, p) {
    const all = await liveSkills(ctx);
    const sameBranch = all.filter((s) => s.branch.toLowerCase() === p.branch.toLowerCase());
    const branch = sameBranch[0]?.branch ?? p.branch;
    if (sameBranch.some((s) => s.name.toLowerCase() === p.name.toLowerCase())) {
      throw new RuleError('That branch already has this skill');
    }
    const skill: Skill = {
      ...newBase(undefined, ctx.processedAt),
      branch,
      track: sameBranch[0]?.track ?? p.track,
      name: p.name,
      parent_id: p.parent_id,
      order: Math.max(-1, ...all.map((s) => s.order)) + 1,
      manual_level_override: null,
      status: 'active',
    };
    await checkParent(ctx, skill, p.parent_id);
    await ctx.db.skills.add(skill);
    ctx.emit({ type: 'SkillChanged', payload: { skillId: skill.id } });
    return skill;
  },
});

export const updateSkill = defineAction({
  type: 'skill.update',
  schema: z
    .object({
      id: z.string().min(1),
      changes: z
        .object({
          name,
          parent_id: z.string().min(1).nullable(),
          manual_level_override: level.nullable(),
        })
        .partial()
        .strict(),
    })
    .strict()
    .refine((p) => Object.keys(p.changes).length > 0, 'nothing to change'),
  tables: [...TABLES],
  async run(ctx, { id, changes }) {
    const current = await getSkill(ctx, id);
    if (changes.name !== undefined) {
      const clash = (await liveSkills(ctx)).some(
        (s) =>
          s.id !== id &&
          s.branch === current.branch &&
          s.name.toLowerCase() === changes.name?.toLowerCase(),
      );
      if (clash) throw new RuleError('That branch already has this skill');
    }
    if (changes.parent_id !== undefined) await checkParent(ctx, current, changes.parent_id);
    const next: Skill = { ...current, ...changes, ...touch(ctx.processedAt) };
    await ctx.db.skills.put(next);
    ctx.emit({ type: 'SkillChanged', payload: { skillId: id } });
    return next;
  },
});

/** Move a skill up or down within its branch. */
export const moveSkill = defineAction({
  type: 'skill.move',
  schema: z.object({ id: z.string().min(1), direction: z.enum(['up', 'down']) }).strict(),
  tables: [...TABLES],
  async run(ctx, { id, direction }) {
    const current = await getSkill(ctx, id);
    const siblings = (await liveSkills(ctx))
      .filter((s) => s.branch === current.branch && s.parent_id === current.parent_id)
      .sort((a, b) => a.order - b.order);
    const at = siblings.findIndex((s) => s.id === id);
    const other = siblings[direction === 'up' ? at - 1 : at + 1];
    if (!other) return current;
    await ctx.db.skills.put({ ...current, order: other.order, ...touch(ctx.processedAt) });
    await ctx.db.skills.put({ ...other, order: current.order, ...touch(ctx.processedAt) });
    ctx.emit({ type: 'SkillChanged', payload: { skillId: id } });
    return current;
  },
});

/** Archive (kept with its history, hidden from the tree) or restore a skill. */
export const archiveSkill = defineAction({
  type: 'skill.archive',
  schema: z.object({ id: z.string().min(1), archived: z.boolean() }).strict(),
  tables: [...TABLES],
  async run(ctx, { id, archived }) {
    const current = await getSkill(ctx, id);
    const next: Skill = {
      ...current,
      status: archived ? 'archived' : 'active',
      ...touch(ctx.processedAt),
    };
    await ctx.db.skills.put(next);
    ctx.emit({ type: 'SkillChanged', payload: { skillId: id } });
    return next;
  },
});

/** Delete an archived skill for good (soft delete; its sub-skills move up a level). */
export const deleteSkill = defineAction({
  type: 'skill.delete',
  schema: z.object({ id: z.string().min(1) }).strict(),
  tables: [...TABLES],
  async run(ctx, { id }) {
    const current = await getSkill(ctx, id);
    if (current.status !== 'archived') throw new RuleError('Archive the skill before deleting it');
    for (const child of (await liveSkills(ctx)).filter((s) => s.parent_id === id)) {
      await ctx.db.skills.put({
        ...child,
        parent_id: current.parent_id,
        ...touch(ctx.processedAt),
      });
    }
    await ctx.db.skills.put({ ...current, deleted_at: ctx.processedAt, ...touch(ctx.processedAt) });
    ctx.emit({ type: 'SkillChanged', payload: { skillId: id } });
    return true;
  },
});

/** Rename a branch or change which side of the 70/30 split it counts for (all its skills). */
export const updateBranch = defineAction({
  type: 'skill.updateBranch',
  schema: z
    .object({ branch: z.string().min(1), name: name.optional(), track: track.optional() })
    .strict()
    .refine((p) => p.name !== undefined || p.track !== undefined, 'nothing to change'),
  tables: [...TABLES],
  async run(ctx, p) {
    const all = await liveSkills(ctx);
    const members = all.filter((s) => s.branch === p.branch);
    if (members.length === 0) throw new RuleError('Branch not found');
    if (
      p.name !== undefined &&
      p.name.toLowerCase() !== p.branch.toLowerCase() &&
      all.some((s) => s.branch.toLowerCase() === p.name?.toLowerCase())
    ) {
      throw new RuleError('There is already a branch with that name');
    }
    for (const s of members) {
      await ctx.db.skills.put({
        ...s,
        branch: p.name ?? s.branch,
        track: p.track ?? s.track,
        ...touch(ctx.processedAt),
      });
    }
    ctx.emit({ type: 'SkillChanged', payload: { skillId: null } });
    return members.length;
  },
});

const evidenceFields = {
  note: z.string().trim().max(500).nullable(),
  link: z.string().trim().max(500).nullable(),
  minutes: z.number().int().min(0).max(100_000),
  day,
};

function checkLink(link: string | null) {
  if (link && !/^https?:\/\/\S+$/i.test(link)) {
    throw new RuleError('A link must start with http:// or https://');
  }
}

/** Record a finished project as proof for a skill. */
export const addProject = defineAction({
  type: 'skill.addProject',
  schema: z
    .object({
      skill_id: z.string().min(1),
      title: z.string().trim().min(1, 'a title is required').max(120),
      note: evidenceFields.note.default(null),
      link: evidenceFields.link.default(null),
      minutes: evidenceFields.minutes.default(0),
      day: day.optional(),
    })
    .strict(),
  tables: [...TABLES],
  async run(ctx, p) {
    await getSkill(ctx, p.skill_id);
    const link = p.link || null;
    checkLink(link);
    const today = await appDayOf(ctx.db, ctx.occurredAt);
    const d = p.day ?? today;
    if (d > today) throw new RuleError('That day hasn’t happened yet');
    const evidence: SkillEvidence = {
      ...newBase(undefined, ctx.processedAt),
      skill_id: p.skill_id,
      type: 'project',
      ref_id: null,
      minutes: p.minutes,
      note: [p.title, p.note].filter(Boolean).join('\n'),
      link,
      day: d,
    };
    await ctx.db.skill_evidence.add(evidence);
    ctx.emit({ type: 'SkillChanged', payload: { skillId: p.skill_id } });
    return evidence;
  },
});

/** Remove a project from a skill (soft delete, so it can sync). */
export const deleteProject = defineAction({
  type: 'skill.deleteProject',
  schema: z.object({ id: z.string().min(1) }).strict(),
  tables: [...TABLES],
  async run(ctx, { id }) {
    const current = await ctx.db.skill_evidence.get(id);
    if (!current || current.deleted_at) throw new RuleError('Project not found');
    await ctx.db.skill_evidence.put({
      ...current,
      deleted_at: ctx.processedAt,
      ...touch(ctx.processedAt),
    });
    ctx.emit({ type: 'SkillChanged', payload: { skillId: current.skill_id } });
    return true;
  },
});
