import { Monitor, Moon, Plus, Sun, X } from 'lucide-react';
import type { ThemePreference } from '@/app/theme';
import { isEnabled } from '@/config/features';
import { ImportPanel } from '@/features/backup/ImportPanel';
import type { Settings, Stat } from '@/core/db/types';
import { addMinutes, formatTime } from '@/data/starter';
import { Button } from '@/ui/Button';
import { Field, Select, TextInput } from '@/ui/Field';
import type { Draft } from './draft';

type Update = (fn: (d: Draft) => Draft) => void;

const TEXTAREA =
  'border-border bg-surface text-text focus-visible:border-accent w-full rounded-md border p-3 text-base outline-none';
type Timing = Pick<Settings, 'wake_window_min' | 'wake_late_cutoff'>;

export function NameStep({ draft, update }: { draft: Draft; update: Update }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted">
        ASCEND turns your real days into steady progress: daily quests, levels and streaks that
        reward showing up — never punish missing. Setup takes about two minutes.
      </p>
      <TextInput
        label="What should the System call you?"
        value={draft.name}
        maxLength={40}
        autoComplete="given-name"
        onChange={(e) => update((d) => ({ ...d, name: e.target.value }))}
      />
      {isEnabled('exportImport') && (
        <details className="border-border mt-4 rounded-lg border p-4">
          <summary className="min-h-11 cursor-pointer py-2 font-medium">
            Already use ASCEND? Restore from a backup
          </summary>
          <div className="pt-2">
            <ImportPanel allowMerge={false} backupFirst={false} />
          </div>
        </details>
      )}
    </div>
  );
}

export function WakeStep({
  draft,
  update,
  timing,
}: {
  draft: Draft;
  update: Update;
  timing: Timing;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted">
        Waking on time is the first win of the day. Tap “I’m up” on the Today screen when you get
        up.
      </p>
      <TextInput
        label="Wake-up time"
        type="time"
        required
        value={draft.wakeTime}
        onChange={(e) => e.target.value && update((d) => ({ ...d, wakeTime: e.target.value }))}
      />
      <ul className="border-border bg-surface shadow-card flex flex-col gap-2 rounded-lg border p-4 text-sm">
        <li>
          <span className="font-medium">On time:</span> up by{' '}
          {formatTime(addMinutes(draft.wakeTime, timing.wake_window_min))} ({timing.wake_window_min}
          -minute window)
        </li>
        <li>
          <span className="font-medium">Late check-in:</span> until{' '}
          {formatTime(timing.wake_late_cutoff)} — still counts as the minimum
        </li>
        <li className="text-muted">The window and cutoff can be changed later in Settings.</li>
      </ul>
    </div>
  );
}

export function GoalsStep({ draft, update }: { draft: Draft; update: Update }) {
  const setQuest = (i: number, patch: Partial<Draft['mainQuests'][number]>) =>
    update((d) => ({
      ...d,
      mainQuests: d.mainQuests.map((m, j) => (j === i ? { ...m, ...patch } : m)),
    }));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted">
        Your Dream is the long-term why; Main Quests are the big goals that lead to it. In a later
        update the System will turn these into weekly steps for you.
      </p>
      <Field label="Dream">
        {(id) => (
          <textarea
            id={id}
            rows={2}
            maxLength={160}
            value={draft.dream.title}
            onChange={(e) =>
              update((d) => ({ ...d, dream: { ...d.dream, title: e.target.value } }))
            }
            className={TEXTAREA}
          />
        )}
      </Field>
      <Field label="Why it matters (optional)">
        {(id) => (
          <textarea
            id={id}
            rows={2}
            maxLength={500}
            value={draft.dream.why}
            onChange={(e) => update((d) => ({ ...d, dream: { ...d.dream, why: e.target.value } }))}
            className={TEXTAREA}
          />
        )}
      </Field>
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Main Quests</h3>
        {draft.mainQuests.map((m, i) => (
          <div key={i} className="flex items-end gap-2">
            <div className="flex-1">
              <TextInput
                label={`Main Quest ${i + 1}`}
                value={m.title}
                maxLength={120}
                onChange={(e) => setQuest(i, { title: e.target.value })}
              />
            </div>
            <div className="w-24">
              <Select
                label="Stat"
                value={m.stat}
                options={(['STR', 'INT', 'WIL'] as const).map((s) => ({ value: s, label: s }))}
                onChange={(e) => setQuest(i, { stat: e.target.value as Stat })}
              />
            </div>
            <Button
              variant="ghost"
              aria-label={`Remove Main Quest ${i + 1}`}
              onClick={() =>
                update((d) => ({ ...d, mainQuests: d.mainQuests.filter((_, j) => j !== i) }))
              }
            >
              <X aria-hidden size={18} />
            </Button>
          </div>
        ))}
        {draft.mainQuests.length < 10 && (
          <Button
            variant="secondary"
            className="self-start"
            onClick={() =>
              update((d) => ({ ...d, mainQuests: [...d.mainQuests, { title: '', stat: 'INT' }] }))
            }
          >
            <Plus aria-hidden size={18} />
            Add Main Quest
          </Button>
        )}
      </div>
    </div>
  );
}

const THEMES: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'system', label: 'Match device', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
];

function Choice({
  selected,
  onSelect,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`flex min-h-11 flex-1 items-center gap-2 rounded-md border px-3 py-2 text-left ${
        selected ? 'border-accent bg-surface-2 font-medium' : 'border-border bg-surface'
      }`}
    >
      {children}
    </button>
  );
}

export function ThemeStep({
  draft,
  update,
  lateStart,
}: {
  draft: Draft;
  update: Update;
  lateStart: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div role="radiogroup" aria-label="Theme" className="flex flex-col gap-2 sm:flex-row">
        {THEMES.map(({ value, label, icon: Icon }) => (
          <Choice
            key={value}
            selected={draft.theme === value}
            onSelect={() => update((d) => ({ ...d, theme: value }))}
          >
            <Icon aria-hidden size={18} />
            {label}
          </Choice>
        ))}
      </div>
      {lateStart && (
        <div className="flex flex-col gap-2">
          <h3 className="font-medium">Start today or tomorrow?</h3>
          <p className="text-muted text-sm">
            It’s late, so today won’t count against you either way.
          </p>
          <div role="radiogroup" aria-label="First day" className="flex flex-col gap-2 sm:flex-row">
            <Choice
              selected={draft.start === 'today'}
              onSelect={() => update((d) => ({ ...d, start: 'today' }))}
            >
              Start today — do a quest or two tonight
            </Choice>
            <Choice
              selected={draft.start === 'tomorrow'}
              onSelect={() => update((d) => ({ ...d, start: 'tomorrow' }))}
            >
              Start tomorrow — Day 1 begins in the morning
            </Choice>
          </div>
        </div>
      )}
    </div>
  );
}
