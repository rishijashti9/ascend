import { PACK_INPUT } from '@/data/compass';
import {
  packSchema,
  type Career,
  type CompassSkill,
  type Pack,
  type Source,
} from '@/data/compass/schema';

/** The validated knowledge pack (parsed once). Problems in the data files fail the tests. */
let cached: Pack | null = null;

export function pack(): Pack {
  cached ??= packSchema.parse(PACK_INPUT);
  return cached;
}

/** Integrity problems (unknown sources, unknown skills, prerequisite cycles…) — empty when fine. */
export function packProblems(p: Pack = pack()): string[] {
  const problems: string[] = [];
  const dup = (kind: string, ids: string[]) => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) problems.push(`duplicate ${kind} id: ${id}`);
      seen.add(id);
    }
  };
  dup(
    'source',
    p.sources.map((s) => s.id),
  );
  dup(
    'career',
    p.careers.map((c) => c.id),
  );
  dup(
    'skill',
    p.skills.map((s) => s.id),
  );
  dup(
    'roadmap',
    p.roadmaps.map((r) => r.id),
  );
  const sources = new Set(p.sources.map((s) => s.id));
  const skills = new Set(p.skills.map((s) => s.id));
  const cite = (where: string, ids: string[]) => {
    for (const id of ids) if (!sources.has(id)) problems.push(`${where}: unknown source ${id}`);
  };
  for (const c of p.careers) {
    cite(`career ${c.id}`, c.sources);
    for (const s of c.skills)
      if (!skills.has(s.id)) problems.push(`career ${c.id}: unknown skill ${s.id}`);
  }
  for (const s of p.skills) {
    cite(`skill ${s.id}`, s.sources);
    for (const pre of s.prereqs)
      if (!skills.has(pre)) problems.push(`skill ${s.id}: unknown prereq ${pre}`);
  }
  for (const r of p.roadmaps) {
    cite(`roadmap ${r.id}`, r.sources);
    for (const st of r.steps)
      if (st.skill && !skills.has(st.skill))
        problems.push(`roadmap ${r.id}: unknown skill ${st.skill}`);
  }
  for (const g of p.guidelines) cite(`guideline ${g.id}`, g.sources);
  for (const h of p.helplines) cite(`helpline ${h.country}`, h.sources);
  // Prerequisites must form no cycle (a learning order must exist).
  const byId = new Map(p.skills.map((s) => [s.id, s]));
  const state = new Map<string, 1 | 2>();
  const visit = (id: string, path: string[]): void => {
    if (state.get(id) === 2) return;
    if (state.get(id) === 1) {
      problems.push(`prerequisite cycle: ${[...path, id].join(' → ')}`);
      return;
    }
    state.set(id, 1);
    for (const pre of byId.get(id)?.prereqs ?? []) visit(pre, [...path, id]);
    state.set(id, 2);
  };
  for (const s of p.skills) visit(s.id, []);
  return problems;
}

export const sourceById = (id: string): Source | undefined =>
  pack().sources.find((s) => s.id === id);
export const careerById = (id: string): Career | undefined =>
  pack().careers.find((c) => c.id === id);
export const skillById = (id: string): CompassSkill | undefined =>
  pack().skills.find((s) => s.id === id);

/** O*NET OnLine page for a career's code. */
export const onetUrl = (code: string) => `https://www.onetonline.org/link/summary/${code}`;
