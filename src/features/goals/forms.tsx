import { useState, type ReactNode } from 'react';
import type { Milestone, MilestoneSource, Stat } from '@/core/db/types';
import { Button } from '@/ui/Button';
import { Field, Select, TextInput } from '@/ui/Field';

/** Forms for dreams, main quests and milestones. Each returns the values to save. */

const TEXTAREA = 'control w-full p-3 text-base';

function FormShell({
  title,
  children,
  canSave,
  busy,
  error,
  onSave,
  onCancel,
  saveLabel,
}: {
  title: string;
  children: ReactNode;
  canSave: boolean;
  busy: boolean;
  error: string | null;
  onSave: () => void;
  onCancel: () => void;
  saveLabel: string;
}) {
  return (
    <form
      aria-label={title}
      className="panel outline-accent outline-2 flex flex-col gap-3 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSave) onSave();
      }}
    >
      <h3 className="display">{title}</h3>
      {children}
      {error && (
        <p role="alert" className="text-warning-text text-sm">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={!canSave || busy}>
          {saveLabel}
        </Button>
        <Button variant="secondary" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function WhyField({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <Field label={label}>
      {(id) => (
        <textarea
          id={id}
          rows={3}
          maxLength={1000}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={TEXTAREA}
        />
      )}
    </Field>
  );
}

interface Common {
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  saveLabel?: string;
}

export interface DreamValues {
  title: string;
  why: string;
}

export function DreamForm({
  initial = { title: '', why: '' },
  onSave,
  ...common
}: Common & { initial?: DreamValues; onSave: (v: DreamValues) => void }) {
  const [v, setV] = useState(initial);
  return (
    <FormShell
      title={initial.title ? 'Edit dream' : 'New dream'}
      canSave={v.title.trim().length > 0}
      onSave={() => onSave({ title: v.title.trim(), why: v.why.trim() })}
      saveLabel={common.saveLabel ?? 'Save'}
      {...common}
    >
      <TextInput
        label="Dream"
        value={v.title}
        maxLength={160}
        onChange={(e) => setV({ ...v, title: e.target.value })}
      />
      <WhyField
        label="Why it matters to me"
        value={v.why}
        onChange={(why) => setV({ ...v, why })}
      />
    </FormShell>
  );
}

export interface MainQuestValues {
  title: string;
  why: string;
  stat: Stat;
  target_date: string | null;
}

export function MainQuestForm({
  initial = { title: '', why: '', stat: 'INT', target_date: null },
  onSave,
  ...common
}: Common & { initial?: MainQuestValues; onSave: (v: MainQuestValues) => void }) {
  const [v, setV] = useState(initial);
  return (
    <FormShell
      title={initial.title ? 'Edit main quest' : 'New main quest'}
      canSave={v.title.trim().length > 0}
      onSave={() => onSave({ ...v, title: v.title.trim(), why: v.why.trim() })}
      saveLabel={common.saveLabel ?? 'Save'}
      {...common}
    >
      <TextInput
        label="Main quest"
        value={v.title}
        maxLength={160}
        onChange={(e) => setV({ ...v, title: e.target.value })}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
        <TextInput
          label="Deadline (optional)"
          type="date"
          value={v.target_date ?? ''}
          onChange={(e) => setV({ ...v, target_date: e.target.value || null })}
        />
      </div>
      <WhyField
        label="Why this matters to me"
        value={v.why}
        onChange={(why) => setV({ ...v, why })}
      />
    </FormShell>
  );
}

export type MilestoneValues = Pick<
  Milestone,
  | 'title'
  | 'size_weight'
  | 'target_type'
  | 'target_value'
  | 'current_source'
  | 'estimated_weekly_quests'
  | 'target_date'
>;

const EMPTY_MILESTONE: MilestoneValues = {
  title: '',
  size_weight: 1,
  target_type: 'manual',
  target_value: null,
  current_source: null,
  estimated_weekly_quests: 4,
  target_date: null,
};

const num = (s: string) => (s.trim() === '' ? null : Number(s));

/** Plain-words check before saving (the action checks again). */
function milestoneProblem(v: MilestoneValues): string | null {
  if (!v.title.trim()) return 'Add a title';
  if (v.target_type !== 'manual' && !(v.target_value && v.target_value > 0)) return 'Add a target';
  if (v.target_type === 'manual' && !(v.estimated_weekly_quests && v.estimated_weekly_quests > 0))
    return 'Estimate how many weekly quests it takes';
  if (v.target_type === 'metric') {
    const src = v.current_source;
    if (src?.kind !== 'body_metric' || !(src.start_value > 0)) return 'Add the starting value';
    const t = v.target_value ?? 0;
    if (src.direction === 'down' ? t >= src.start_value : t <= src.start_value)
      return `The target must be ${src.direction === 'down' ? 'below' : 'above'} the start`;
  }
  return null;
}

export function MilestoneForm({
  initial = EMPTY_MILESTONE,
  onSave,
  ...common
}: Common & { initial?: MilestoneValues; onSave: (v: MilestoneValues) => void }) {
  const [v, setV] = useState(initial);
  const problem = milestoneProblem(v);
  const metric: Extract<MilestoneSource, { kind: 'body_metric' }> =
    v.current_source?.kind === 'body_metric'
      ? v.current_source
      : { kind: 'body_metric', metric: 'weight', direction: 'down', start_value: 0 };

  const setType = (target_type: MilestoneValues['target_type']) =>
    setV({
      ...v,
      target_type,
      target_value: target_type === 'manual' ? null : v.target_value,
      current_source:
        target_type === 'metric'
          ? metric
          : target_type === 'count'
            ? { kind: 'linked_quests' }
            : null,
      estimated_weekly_quests: target_type === 'manual' ? (v.estimated_weekly_quests ?? 4) : null,
    });

  return (
    <FormShell
      title={initial.title ? 'Edit milestone' : 'New milestone'}
      canSave={problem === null}
      onSave={() => onSave({ ...v, title: v.title.trim() })}
      saveLabel={common.saveLabel ?? 'Save'}
      {...common}
    >
      <TextInput
        label="Milestone"
        value={v.title}
        maxLength={160}
        onChange={(e) => setV({ ...v, title: e.target.value })}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select
          label="Progress measured by"
          value={v.target_type}
          options={[
            { value: 'manual', label: 'Weekly quests (I mark it done)' },
            { value: 'count', label: 'A count (e.g. 6 mock tests)' },
            { value: 'metric', label: 'A body measurement' },
          ]}
          onChange={(e) => setType(e.target.value as MilestoneValues['target_type'])}
        />
        <Select
          label="Size"
          value={String(v.size_weight)}
          options={[
            { value: '1', label: 'Small' },
            { value: '2', label: 'Medium' },
            { value: '3', label: 'Large' },
          ]}
          onChange={(e) => setV({ ...v, size_weight: Number(e.target.value) })}
        />
        {v.target_type === 'manual' && (
          <TextInput
            label="Weekly quests it should take"
            type="number"
            min={1}
            value={v.estimated_weekly_quests ?? ''}
            onChange={(e) => setV({ ...v, estimated_weekly_quests: num(e.target.value) })}
          />
        )}
        {v.target_type === 'count' && (
          <TextInput
            label="Target count"
            type="number"
            min={1}
            value={v.target_value ?? ''}
            onChange={(e) => setV({ ...v, target_value: num(e.target.value) })}
          />
        )}
        {v.target_type === 'metric' && (
          <>
            <Select
              label="Measurement"
              value={`${metric.metric}:${metric.direction}`}
              options={[
                { value: 'weight:down', label: 'Weight — lose' },
                { value: 'weight:up', label: 'Weight — gain' },
                { value: 'waist:down', label: 'Waist — reduce' },
              ]}
              onChange={(e) => {
                const [m, d] = e.target.value.split(':') as ['weight' | 'waist', 'down' | 'up'];
                setV({ ...v, current_source: { ...metric, metric: m, direction: d } });
              }}
            />
            <TextInput
              label={`Start (${metric.metric === 'weight' ? 'kg' : 'cm'})`}
              type="number"
              step={0.1}
              value={metric.start_value || ''}
              onChange={(e) =>
                setV({
                  ...v,
                  current_source: { ...metric, start_value: Number(e.target.value) || 0 },
                })
              }
            />
            <TextInput
              label={`Target (${metric.metric === 'weight' ? 'kg' : 'cm'})`}
              type="number"
              step={0.1}
              value={v.target_value ?? ''}
              onChange={(e) => setV({ ...v, target_value: num(e.target.value) })}
            />
          </>
        )}
        <TextInput
          label="Target date (optional)"
          type="date"
          value={v.target_date ?? ''}
          onChange={(e) => setV({ ...v, target_date: e.target.value || null })}
        />
      </div>
      {problem && v.title.trim() && <p className="text-muted text-sm">{problem}</p>}
    </FormShell>
  );
}
