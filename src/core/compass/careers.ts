import type { Skill } from '@/core/db/types';
import type { Career, CompassSkill } from '@/data/compass/schema';
import { pack } from './pack';

/**
 * Career → skill graph (SPEC 6.7 B career pillar), pure: the skills a career needs plus their
 * prerequisites in a valid learning order, and which of them the user's skill tree already
 * covers (with its computed level 0–5).
 */

/** Skills in a learning order: every prerequisite before the skills that need it. */
export function learningOrder(ids: readonly string[], skills = pack().skills): CompassSkill[] {
  const byId = new Map(skills.map((s) => [s.id, s]));
  const out: CompassSkill[] = [];
  const seen = new Set<string>();
  const visit = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    const s = byId.get(id);
    if (!s) return;
    for (const pre of s.prereqs) visit(pre);
    out.push(s);
  };
  for (const id of ids) visit(id);
  return out;
}

/** A career's skills, core first, plus every prerequisite, in learning order. */
export function careerSkillGraph(career: Career): CompassSkill[] {
  const ranked = [...career.skills].sort((a, b) => b.importance - a.importance).map((s) => s.id);
  return learningOrder(ranked);
}

export interface TreeMatch {
  skill: CompassSkill;
  /** The user's skill-tree entry that counts as this skill (if any). */
  tree: Pick<Skill, 'id' | 'name'> | null;
  /** Its level 0–5 (0 when not in the tree). */
  level: number;
}

const norm = (s: string) => s.trim().toLowerCase();

/** Maps compass skills onto the user's skill tree by name (and the skill's `matches`). */
export function matchSkillTree(
  skills: readonly CompassSkill[],
  tree: readonly Pick<Skill, 'id' | 'name' | 'status'>[],
  levelOf: (treeSkillId: string) => number,
): TreeMatch[] {
  const active = tree.filter((t) => t.status === 'active');
  return skills.map((skill) => {
    const names = new Set([norm(skill.name), ...skill.matches.map(norm)]);
    const hit = active.find((t) => names.has(norm(t.name))) ?? null;
    return { skill, tree: hit, level: hit ? levelOf(hit.id) : 0 };
  });
}

/** Careers in a field, deep ones first then by title. */
export function careersIn(field: Career['field'] | 'all' = 'all'): Career[] {
  return pack()
    .careers.filter((c) => field === 'all' || c.field === field)
    .sort((a, b) => Number(b.deep) - Number(a.deep) || a.title.localeCompare(b.title));
}
