import { ArrowDown, ArrowUp, ExternalLink, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import type { Skill } from '@/core/db/types';
import { MAX_SKILL_LEVEL, projectNote, projectTitle } from '@/core/engine/skills';
import { useHabits } from '@/core/state/habits';
import { useQuests } from '@/core/state/quests';
import { useSkills } from '@/core/state/skills';
import { Button } from '@/ui/Button';
import { Select, TextInput } from '@/ui/Field';
import { useAction } from '@/ui/hooks/useAction';
import { useDialog } from '@/ui/hooks/useDialog';
import { ProgressBar } from '@/ui/ProgressBar';
import { Stat } from '@/features/review/Stat';
import { formatMinutes, hours } from './format';
import { ProjectForm } from './SkillForms';
import { LevelPips } from './SkillTree';

/** One skill up close: level and what the next needs, projects, links, and editing. */
export function SkillSheet({ skillId, onClose }: { skillId: string; onClose: () => void }) {
  const skill = useSkills((s) => s.skills.find((x) => x.id === skillId));
  const progress = useSkills((s) => s.progress.get(skillId));
  const projects = useSkills((s) => s.projects.get(skillId)) ?? [];
  const habits = useHabits((s) => s.habits);
  const weekly = useQuests((s) => s.weekly);
  const side = useQuests((s) => s.side);
  const [adding, setAdding] = useState(false);
  const { run, busy, error } = useAction();
  const closeRef = useDialog(onClose);
  if (!skill || !progress) return null;

  const linked = [
    ...habits.filter((h) => h.status === 'active').map((h) => ({ ...h, kind: 'Daily' })),
    ...weekly.filter((q) => q.status === 'active').map((q) => ({ ...q, kind: 'Weekly' })),
    ...side.filter((q) => q.status === 'active').map((q) => ({ ...q, kind: 'Side' })),
  ].filter((q) => q.skill_ids.includes(skillId));
  const next = progress.next;
  const toNext = next ? Math.min(1, progress.minutes / (next.hours * 60)) : 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="skill-title"
      className="bg-bg fixed inset-0 z-40 overflow-y-auto"
    >
      <div className="mx-auto flex min-h-dvh max-w-xl flex-col gap-5 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-muted text-xs font-semibold tracking-wide uppercase">
              {skill.branch}
              {skill.status === 'archived' && ' · archived'}
            </p>
            <h2 id="skill-title" className="display text-xl">
              {skill.name}
            </h2>
          </div>
          <button
            type="button"
            ref={closeRef}
            aria-label="Close"
            onClick={onClose}
            className="text-muted hover:text-text hover:bg-surface-2 flex size-11 items-center justify-center rounded-full"
          >
            <X aria-hidden size={20} />
          </button>
        </header>

        <section aria-label="Current level" className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <span className="display text-4xl tabular-nums">{progress.level}</span>
            <div className="flex flex-col gap-1">
              <span className="text-muted text-sm">
                Level {progress.level} of {MAX_SKILL_LEVEL}
                {progress.overridden && ` · set by you (computed: ${progress.computedLevel})`}
              </span>
              <LevelPips level={progress.level} />
            </div>
          </div>
          {next ? (
            <>
              <ProgressBar value={toNext} label={`Progress to level ${next.level}`} />
              <p className="text-muted text-xs">
                Level {next.level} needs {next.hours} h
                {next.projects > 0 &&
                  ` and ${next.projects} finished project${next.projects === 1 ? '' : 's'}`}{' '}
                — {hours(progress.minutes)} h
                {next.projects > 0 &&
                  `, ${progress.projects} project${progress.projects === 1 ? '' : 's'}`}{' '}
                so far.
              </p>
            </>
          ) : (
            <p className="text-success-text text-sm">Top level reached.</p>
          )}
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Time" value={formatMinutes(progress.minutes)} />
            <Stat label="Quests done" value={String(progress.questsDone)} />
            <Stat label="Projects" value={String(progress.projects)} />
          </div>
        </section>

        <section aria-label="Projects" className="flex flex-col gap-2">
          <h3 className="display text-muted text-sm">Finished projects</h3>
          {projects.length === 0 && !adding && (
            <p className="text-muted text-sm">
              None yet. A finished project with a link is the proof levels 4 and 5 ask for.
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {projects.map((p) => (
              <li key={p.id} className="inset flex items-start gap-2 p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{projectTitle(p)}</p>
                  {projectNote(p) && <p className="text-muted text-sm">{projectNote(p)}</p>}
                  <p className="text-muted text-xs">
                    {p.day}
                    {p.minutes > 0 && ` · ${formatMinutes(p.minutes)}`}
                  </p>
                  {p.link && (
                    <a
                      href={p.link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent-text inline-flex items-center gap-1 text-sm break-all"
                    >
                      <ExternalLink aria-hidden size={14} /> {p.link}
                    </a>
                  )}
                </div>
                <button
                  type="button"
                  aria-label={`Remove project ${projectTitle(p)}`}
                  disabled={busy}
                  onClick={() => void run({ type: 'skill.deleteProject', payload: { id: p.id } })}
                  className="text-muted hover:text-text hover:bg-surface-2 flex size-11 shrink-0 items-center justify-center rounded-full"
                >
                  <Trash2 aria-hidden size={16} />
                </button>
              </li>
            ))}
          </ul>
          {adding ? (
            <ProjectForm skillId={skillId} onDone={() => setAdding(false)} />
          ) : (
            <Button variant="secondary" onClick={() => setAdding(true)} className="self-start">
              Add a finished project
            </Button>
          )}
        </section>

        <section aria-label="Linked quests" className="flex flex-col gap-2">
          <h3 className="display text-muted text-sm">Quests that count for it</h3>
          {linked.length === 0 ? (
            <p className="text-muted text-sm">
              None. Link a quest to this skill when you edit it, or tag a focus session.
            </p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {linked.map((q) => (
                <li key={q.id}>
                  {q.title} <span className="text-muted">· {q.kind}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <SkillEditor skill={skill} computed={progress.computedLevel} onClose={onClose} />
        {error && (
          <p role="alert" className="text-warning-text text-sm">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

function SkillEditor({
  skill,
  computed,
  onClose,
}: {
  skill: Skill;
  computed: number;
  onClose: () => void;
}) {
  const all = useSkills((s) => s.skills);
  const siblings = all
    .filter((x) => x.branch === skill.branch && x.status === 'active' && x.id !== skill.id)
    .sort((a, b) => a.order - b.order);
  const { run, busy, error } = useAction();
  const [name, setName] = useState(skill.name);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <section aria-label="Edit skill" className="border-border flex flex-col gap-3 border-t pt-4">
      <h3 className="display text-muted text-sm">Edit</h3>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <TextInput
            label="Name"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <Button
          variant="secondary"
          disabled={busy || !name.trim() || name.trim() === skill.name}
          onClick={() =>
            void run({ type: 'skill.update', payload: { id: skill.id, changes: { name } } })
          }
        >
          Rename
        </Button>
      </div>
      <Select
        label="Level"
        value={skill.manual_level_override === null ? '' : String(skill.manual_level_override)}
        onChange={(e) =>
          void run({
            type: 'skill.update',
            payload: {
              id: skill.id,
              changes: {
                manual_level_override: e.target.value === '' ? null : Number(e.target.value),
              },
            },
          })
        }
        options={[
          { value: '', label: `From my practice (${computed})` },
          ...Array.from({ length: MAX_SKILL_LEVEL + 1 }, (_, l) => ({
            value: String(l),
            label: `Set to ${l}`,
          })),
        ]}
      />
      {siblings.length > 0 && (
        <Select
          label="Under"
          value={skill.parent_id ?? ''}
          onChange={(e) =>
            void run({
              type: 'skill.update',
              payload: { id: skill.id, changes: { parent_id: e.target.value || null } },
            })
          }
          options={[
            { value: '', label: `Directly in ${skill.branch}` },
            ...siblings.map((s) => ({ value: s.id, label: s.name })),
          ]}
        />
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          aria-label="Move up"
          disabled={busy}
          onClick={() =>
            void run({ type: 'skill.move', payload: { id: skill.id, direction: 'up' } })
          }
        >
          <ArrowUp aria-hidden size={16} /> Up
        </Button>
        <Button
          variant="secondary"
          aria-label="Move down"
          disabled={busy}
          onClick={() =>
            void run({ type: 'skill.move', payload: { id: skill.id, direction: 'down' } })
          }
        >
          <ArrowDown aria-hidden size={16} /> Down
        </Button>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() =>
            void run({
              type: 'skill.archive',
              payload: { id: skill.id, archived: skill.status === 'active' },
            })
          }
        >
          {skill.status === 'active' ? 'Archive' : 'Restore'}
        </Button>
        {skill.status === 'archived' &&
          (confirmDelete ? (
            <Button
              variant="danger"
              disabled={busy}
              onClick={() =>
                void run({ type: 'skill.delete', payload: { id: skill.id } }).then(
                  (ok) => ok && onClose(),
                )
              }
            >
              Delete forever
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
              Delete…
            </Button>
          ))}
      </div>
      {skill.status === 'archived' && (
        <p className="text-muted text-xs">
          Archived skills keep their history but leave the tree. Deleting removes the skill for
          good; its quests and sessions stay.
        </p>
      )}
      {error && (
        <p role="alert" className="text-warning-text text-sm">
          {error}
        </p>
      )}
    </section>
  );
}
