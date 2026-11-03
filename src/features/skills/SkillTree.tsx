import { Pencil } from 'lucide-react';
import type { Skill } from '@/core/db/types';
import { MAX_SKILL_LEVEL, type SkillProgress } from '@/core/engine/skills';
import type { Branch } from '@/core/state/skills';
import { TRACK_LABEL } from '@/data/skills';
import { hours } from './format';

/**
 * The tree itself (SPEC 6.5): each branch is a node with a line down to its skills; sub-skills
 * hang one step further in. Nodes show the level as a number and five small pips — no clutter.
 */
export function SkillTree({
  branch,
  progress,
  onOpen,
  onEditBranch,
}: {
  branch: Branch;
  progress: Map<string, SkillProgress>;
  onOpen: (skill: Skill) => void;
  onEditBranch: (branch: Branch) => void;
}) {
  const active = branch.skills.filter((s) => s.status === 'active');
  const ids = new Set(active.map((s) => s.id));
  // A sub-skill whose parent is archived shows at the top level.
  const roots = active.filter((s) => s.parent_id === null || !ids.has(s.parent_id));
  const childrenOf = (id: string) => active.filter((s) => s.parent_id === id);

  return (
    <section
      aria-label={branch.name}
      className="border-border bg-surface shadow-card rounded-lg border p-4"
    >
      <header className="flex items-center gap-3">
        <span
          aria-hidden
          className="border-accent bg-surface-2 size-4 shrink-0 rounded-full border-2"
        />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">{branch.name}</h2>
          <p className="text-muted text-xs">{TRACK_LABEL[branch.track]}</p>
        </div>
        <button
          type="button"
          aria-label={`Edit branch ${branch.name}`}
          onClick={() => onEditBranch(branch)}
          className="text-muted flex size-11 items-center justify-center rounded-md"
        >
          <Pencil aria-hidden size={16} />
        </button>
      </header>
      {roots.length === 0 ? (
        <p className="text-muted mt-2 ml-7 text-sm">No active skills in this branch.</p>
      ) : (
        <SkillList skills={roots} childrenOf={childrenOf} progress={progress} onOpen={onOpen} />
      )}
    </section>
  );
}

function SkillList({
  skills,
  childrenOf,
  progress,
  onOpen,
}: {
  skills: Skill[];
  childrenOf: (id: string) => Skill[];
  progress: Map<string, SkillProgress>;
  onOpen: (skill: Skill) => void;
}) {
  return (
    <ul className="border-border ml-[7px] border-l">
      {skills.map((s) => {
        const kids = childrenOf(s.id);
        return (
          <li key={s.id}>
            <SkillNode skill={s} progress={progress.get(s.id)} onOpen={onOpen} />
            {kids.length > 0 && (
              <div className="ml-6">
                <SkillList
                  skills={kids}
                  childrenOf={childrenOf}
                  progress={progress}
                  onOpen={onOpen}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function SkillNode({
  skill,
  progress,
  onOpen,
}: {
  skill: Skill;
  progress: SkillProgress | undefined;
  onOpen: (skill: Skill) => void;
}) {
  const level = progress?.level ?? 0;
  const h = hours(progress?.minutes ?? 0);
  return (
    <button
      type="button"
      onClick={() => onOpen(skill)}
      aria-label={`${skill.name}, level ${level} of ${MAX_SKILL_LEVEL}, ${h} hours`}
      className="hover:bg-surface-2 flex min-h-11 w-full items-center gap-2 rounded-md py-1 pr-2 text-left"
    >
      <span aria-hidden className="bg-border h-px w-4 shrink-0" />
      <span
        aria-hidden
        className={`flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold tabular-nums ${
          level > 0 ? 'border-accent text-accent-text' : 'border-border text-muted'
        }`}
      >
        {level}
      </span>
      <span className="min-w-0 flex-1 truncate">{skill.name}</span>
      <span aria-hidden className="text-muted text-xs tabular-nums">
        {h > 0 ? `${h} h` : ''}
      </span>
      <LevelPips level={level} />
    </button>
  );
}

export function LevelPips({ level }: { level: number }) {
  return (
    <span aria-hidden className="flex gap-0.5">
      {Array.from({ length: MAX_SKILL_LEVEL }, (_, i) => (
        <span
          key={i}
          className={`size-1.5 rounded-full ${i < level ? 'bg-accent' : 'bg-surface-2'}`}
        />
      ))}
    </span>
  );
}
