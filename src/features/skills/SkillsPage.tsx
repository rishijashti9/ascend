import { Plus } from 'lucide-react';
import { useState } from 'react';
import type { Branch } from '@/core/state/skills';
import { useSkills } from '@/core/state/skills';
import { Button } from '@/ui/Button';
import { useAction } from '@/ui/hooks/useAction';
import { BalanceCard } from './BalanceCard';
import { levelRules } from './format';
import { AddSkillForm, BranchForm } from './SkillForms';
import { SkillSheet } from './SkillSheet';
import { SkillTree } from './SkillTree';

/** Skills (SPEC 7.9, 6.5): the 70/30 study balance and the skill tree. */
export function SkillsPage() {
  const status = useSkills((s) => s.status);
  const branches = useSkills((s) => s.branches);
  const skills = useSkills((s) => s.skills);
  const progress = useSkills((s) => s.progress);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const { run, busy } = useAction();
  if (status !== 'ready') return null;

  const archived = skills.filter((s) => s.status === 'archived');

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="display text-2xl">Skills</h1>
        {!adding && branches.length > 0 && (
          <Button variant="secondary" onClick={() => setAdding(true)}>
            <Plus aria-hidden size={16} /> Add skill
          </Button>
        )}
      </div>

      <BalanceCard />

      {adding && (
        <section className="panel p-4">
          <AddSkillForm branches={branches} onDone={() => setAdding(false)} />
        </section>
      )}
      {editing && (
        <section className="panel p-4">
          <BranchForm branch={editing} onDone={() => setEditing(null)} />
        </section>
      )}

      {branches.length === 0 ? (
        <section className="panel flex flex-col items-start gap-3 p-4">
          <p>Your skill tree is empty.</p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => void run({ type: 'skills.seed', payload: {} })}>
              Add the starter roadmap
            </Button>
            <Button variant="secondary" onClick={() => setAdding(true)}>
              Start my own branch
            </Button>
          </div>
        </section>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {branches.map((b) => (
            <SkillTree
              key={b.name}
              branch={b}
              progress={progress}
              onOpen={(s) => setOpen(s.id)}
              onEditBranch={setEditing}
            />
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <section aria-label="Archived skills" className="flex flex-col gap-2">
          <button
            type="button"
            aria-expanded={showArchived}
            onClick={() => setShowArchived((v) => !v)}
            className="text-muted min-h-11 self-start text-sm"
          >
            Archived ({archived.length}) {showArchived ? '▴' : '▾'}
          </button>
          {showArchived && (
            <ul className="flex flex-col gap-1">
              {archived.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setOpen(s.id)}
                    className="hover:bg-surface-2 min-h-11 w-full rounded-md px-2 text-left"
                  >
                    {s.name} <span className="text-muted text-sm">· {s.branch}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <p className="text-muted text-xs">
        Levels come from your practice: focus sessions tagged with a skill, quests linked to it, and
        finished projects. {levelRules()}
      </p>

      {open && <SkillSheet skillId={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
