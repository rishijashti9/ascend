import { useState, type FormEvent } from 'react';
import type { SkillTrack } from '@/core/db/types';
import type { Branch } from '@/core/state/skills';
import { TRACK_LABEL } from '@/data/skills';
import { Button } from '@/ui/Button';
import { Select, TextInput } from '@/ui/Field';
import { useAction } from '@/ui/hooks/useAction';

const TRACKS = (Object.keys(TRACK_LABEL) as SkillTrack[]).map((t) => ({
  value: t,
  label: TRACK_LABEL[t],
}));
const NEW_BRANCH = '__new__';

function Alert({ text }: { text: string | null }) {
  return text ? (
    <p role="alert" className="text-warning-text text-sm">
      {text}
    </p>
  ) : null;
}

/** Add a skill to an existing branch (optionally under another skill) or start a new branch. */
export function AddSkillForm({ branches, onDone }: { branches: Branch[]; onDone: () => void }) {
  const { run, busy, error } = useAction();
  const [branch, setBranch] = useState(branches[0]?.name ?? NEW_BRANCH);
  const [newBranch, setNewBranch] = useState('');
  const [track, setTrack] = useState<SkillTrack>('other');
  const [name, setName] = useState('');
  const [parent, setParent] = useState('');
  const isNew = branch === NEW_BRANCH;
  const parents =
    branches.find((b) => b.name === branch)?.skills.filter((s) => s.status === 'active') ?? [];

  async function submit(e: FormEvent) {
    e.preventDefault();
    const ok = await run({
      type: 'skill.create',
      payload: {
        branch: isNew ? newBranch : branch,
        name,
        track,
        parent_id: !isNew && parent ? parent : null,
      },
    });
    if (ok) onDone();
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3" aria-label="Add a skill">
      <Select
        label="Branch"
        value={branch}
        onChange={(e) => {
          setBranch(e.target.value);
          setParent('');
        }}
        options={[
          ...branches.map((b) => ({ value: b.name, label: b.name })),
          { value: NEW_BRANCH, label: 'New branch…' },
        ]}
      />
      {isNew && (
        <>
          <TextInput
            label="New branch name"
            value={newBranch}
            maxLength={60}
            placeholder="e.g. German"
            onChange={(e) => setNewBranch(e.target.value)}
          />
          <Select
            label="Counts for"
            value={track}
            onChange={(e) => setTrack(e.target.value as SkillTrack)}
            options={TRACKS}
          />
        </>
      )}
      <TextInput
        label="Skill"
        value={name}
        maxLength={60}
        placeholder="e.g. Motion planning"
        onChange={(e) => setName(e.target.value)}
      />
      {!isNew && parents.length > 0 && (
        <Select
          label="Under (optional)"
          value={parent}
          onChange={(e) => setParent(e.target.value)}
          options={[
            { value: '', label: `Directly in ${branch}` },
            ...parents.map((s) => ({ value: s.id, label: s.name })),
          ]}
        />
      )}
      <Alert text={error} />
      <div className="flex gap-2">
        <Button type="submit" disabled={busy || !name.trim() || (isNew && !newBranch.trim())}>
          Add skill
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** Rename a branch or change which side of the 70/30 split it counts for. */
export function BranchForm({ branch, onDone }: { branch: Branch; onDone: () => void }) {
  const { run, busy, error } = useAction();
  const [name, setName] = useState(branch.name);
  const [track, setTrack] = useState<SkillTrack>(branch.track);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const changes = {
      ...(name.trim() !== branch.name ? { name } : {}),
      ...(track !== branch.track ? { track } : {}),
    };
    if (Object.keys(changes).length === 0) return onDone();
    if (await run({ type: 'skill.updateBranch', payload: { branch: branch.name, ...changes } })) {
      onDone();
    }
  }

  return (
    <form
      onSubmit={(e) => void submit(e)}
      className="flex flex-col gap-3"
      aria-label={`Edit branch ${branch.name}`}
    >
      <TextInput
        label="Branch name"
        value={name}
        maxLength={60}
        onChange={(e) => setName(e.target.value)}
      />
      <Select
        label="Counts for"
        value={track}
        onChange={(e) => setTrack(e.target.value as SkillTrack)}
        options={TRACKS}
      />
      <p className="text-muted text-xs">
        The study balance compares AI & Robotics with Games; other branches still level up but stay
        out of the split.
      </p>
      <Alert text={error} />
      <div className="flex gap-2">
        <Button type="submit" disabled={busy || !name.trim()}>
          Save
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** Record a finished project as proof (title, optional note, link and hours). */
export function ProjectForm({ skillId, onDone }: { skillId: string; onDone: () => void }) {
  const { run, busy, error } = useAction();
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [link, setLink] = useState('');
  const [h, setH] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    const minutes = h.trim() ? Math.round(Number(h) * 60) : 0;
    const ok = await run({
      type: 'skill.addProject',
      payload: {
        skill_id: skillId,
        title,
        note: note.trim() || null,
        link: link.trim() || null,
        minutes: Number.isFinite(minutes) ? Math.max(0, minutes) : 0,
      },
    });
    if (ok) onDone();
  }

  return (
    <form
      onSubmit={(e) => void submit(e)}
      className="bg-surface-2 flex flex-col gap-3 rounded-lg p-3"
      aria-label="Add a finished project"
    >
      <TextInput
        label="Project"
        value={title}
        maxLength={120}
        placeholder="e.g. TurtleBot SLAM in Gazebo"
        onChange={(e) => setTitle(e.target.value)}
      />
      <TextInput
        label="Note (optional)"
        value={note}
        maxLength={500}
        onChange={(e) => setNote(e.target.value)}
      />
      <TextInput
        label="Link (optional)"
        type="url"
        inputMode="url"
        value={link}
        placeholder="https://github.com/…"
        onChange={(e) => setLink(e.target.value)}
      />
      <TextInput
        label="Hours spent (optional)"
        type="number"
        inputMode="decimal"
        min={0}
        step={0.5}
        value={h}
        hint="Only time not already logged with quests or focus sessions."
        onChange={(e) => setH(e.target.value)}
      />
      <Alert text={error} />
      <div className="flex gap-2">
        <Button type="submit" disabled={busy || !title.trim()}>
          Save project
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
