import { useState } from 'react';
import { SkillPicker } from '@/ui/SkillPicker';
import { GAME } from '@/config/game';
import type { Difficulty, Stat } from '@/core/db/types';
import { NEW_QUEST, type QuestDefValues } from './questDefValues';
import { useGoals } from '@/core/state/goals';
import { Button } from '@/ui/Button';
import { Select, TextInput } from '@/ui/Field';

/** Goal choices: active milestones (under their main quest) and active main quests. */
function useGoalOptions() {
  const milestones = useGoals((s) => s.milestones);
  const mainQuests = useGoals((s) => s.mainQuests);
  const live = mainQuests.filter((q) => q.status === 'active');
  const mqTitle = (id: string) => mainQuests.find((q) => q.id === id)?.title ?? '';
  return [
    { value: '', label: 'Not linked (counts toward its stat only)' },
    ...milestones
      .filter((m) => m.status === 'active' || m.status === 'upcoming')
      .map((m) => ({
        value: `milestone:${m.id}`,
        label: `${m.title} — ${mqTitle(m.main_quest_id)}`,
      })),
    ...live.map((q) => ({ value: `main_quest:${q.id}`, label: `${q.title} (main quest)` })),
  ];
}

/** Create/edit form for a weekly or side quest. */
export function QuestDefForm({
  kind,
  initial = NEW_QUEST,
  busy,
  error,
  onSave,
  onCancel,
  saveLabel,
}: {
  kind: 'weekly' | 'side';
  initial?: QuestDefValues;
  busy: boolean;
  error: string | null;
  onSave: (v: QuestDefValues) => void;
  onCancel: () => void;
  saveLabel: string;
}) {
  const [v, setV] = useState(initial);
  const options = useGoalOptions();
  const link =
    v.linked_goal_type && v.linked_goal_id ? `${v.linked_goal_type}:${v.linked_goal_id}` : '';
  const valid =
    v.title.trim().length > 0 &&
    (v.measure === 'check' || (v.target_value !== null && v.target_value > 0));

  return (
    <form
      aria-label={initial.title ? `Edit ${initial.title}` : `New ${kind} quest`}
      className="border-accent bg-surface shadow-card flex flex-col gap-3 rounded-lg border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSave({ ...v, title: v.title.trim() });
      }}
    >
      <TextInput
        label="Title"
        value={v.title}
        maxLength={120}
        onChange={(e) => setV({ ...v, title: e.target.value })}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label="Stat"
          value={v.stat}
          options={[
            { value: 'STR', label: 'STR — Strength' },
            { value: 'INT', label: 'INT — Intellect' },
            { value: 'WIL', label: 'WIL — Willpower' },
          ]}
          onChange={(e) => setV({ ...v, stat: e.target.value as Stat })}
        />
        <Select
          label="Difficulty"
          value={v.difficulty}
          options={(['easy', 'normal', 'hard', 'epic'] as const).map((d) => ({
            value: d,
            label: `${d[0]?.toUpperCase()}${d.slice(1)} — ${GAME.xpByDifficulty[d]} XP`,
          }))}
          onChange={(e) => setV({ ...v, difficulty: e.target.value as Difficulty })}
        />
        <Select
          label="Done when"
          value={v.measure}
          options={[
            { value: 'check', label: 'I tick it done' },
            { value: 'count', label: 'A count is reached' },
            { value: 'minutes', label: 'Minutes are reached' },
          ]}
          onChange={(e) => {
            const measure = e.target.value as QuestDefValues['measure'];
            setV({
              ...v,
              measure,
              target_value:
                measure === 'check' ? null : (v.target_value ?? (measure === 'count' ? 3 : 120)),
            });
          }}
        />
        {v.measure !== 'check' && (
          <TextInput
            label={v.measure === 'count' ? 'Target count' : 'Target minutes'}
            type="number"
            min={1}
            value={v.target_value ?? ''}
            onChange={(e) =>
              setV({ ...v, target_value: e.target.value ? Number(e.target.value) : null })
            }
          />
        )}
        {kind === 'side' && (
          <TextInput
            label="Due (optional)"
            type="date"
            value={v.due_day ?? ''}
            onChange={(e) => setV({ ...v, due_day: e.target.value || null })}
          />
        )}
      </div>
      <Select
        label="Toward goal"
        value={link}
        options={options}
        onChange={(e) => {
          const [type, id] = e.target.value.split(':') as ['main_quest' | 'milestone', string];
          setV({
            ...v,
            linked_goal_type: e.target.value ? type : null,
            linked_goal_id: e.target.value ? id : null,
          });
        }}
      />
      <SkillPicker value={v.skill_ids} onChange={(ids) => setV({ ...v, skill_ids: ids })} />
      {error && (
        <p role="alert" className="text-warning-text text-sm">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={!valid || busy}>
          {saveLabel}
        </Button>
        <Button variant="secondary" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
