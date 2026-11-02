import { Monitor, Moon, Star, Sun } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { ThemePreference } from '@/app/theme';
import { GAME } from '@/config/game';
import { deleteAllData } from '@/core/db/open';
import type { Settings } from '@/core/db/types';
import { logError } from '@/core/errorLog';
import { useHabits } from '@/core/state/habits';
import { rebuildProgress } from '@/core/state/progress';
import { addMinutes, formatTime } from '@/data/starter';
import { Button } from '@/ui/Button';
import { Select, TextInput } from '@/ui/Field';
import { useAction } from '@/ui/hooks/useAction';

export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      aria-label={title}
      className="border-border bg-surface shadow-card flex flex-col gap-4 rounded-lg border p-4"
    >
      <h2 className="text-muted text-sm font-medium">{title}</h2>
      {children}
    </section>
  );
}

function Alert({ text }: { text: string | null }) {
  return text ? (
    <p role="alert" className="text-warning-text text-sm">
      {text}
    </p>
  ) : null;
}

const THEMES: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'system', label: 'Match device', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
];

export function AppearanceSection({ settings }: { settings: Settings }) {
  const { run, busy, error } = useAction();
  return (
    <Card title="Appearance">
      <div role="radiogroup" aria-label="Theme" className="flex flex-col gap-2 sm:flex-row">
        {THEMES.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={settings.theme === value}
            disabled={busy}
            onClick={() => void run({ type: 'settings.update', payload: { theme: value } })}
            className={`flex min-h-11 flex-1 items-center gap-2 rounded-md border px-3 ${
              settings.theme === value
                ? 'border-accent bg-surface-2 font-medium'
                : 'border-border bg-surface'
            }`}
          >
            <Icon aria-hidden size={18} />
            {label}
          </button>
        ))}
      </div>
      <Alert text={error} />
    </Card>
  );
}

const hourLabel = (h: number) => (h === 0 ? 'Midnight' : formatTime(`0${h}:00`));

export function DaySection({ settings }: { settings: Settings }) {
  const { run, busy, error } = useAction();
  return (
    <Card title="Day and week">
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label="New day starts at"
          value={String(settings.day_start_hour)}
          disabled={busy}
          options={[0, 1, 2, 3, 4, 5, 6].map((h) => ({ value: String(h), label: hourLabel(h) }))}
          onChange={(e) =>
            void run({
              type: 'settings.update',
              payload: { day_start_hour: Number(e.target.value) },
            })
          }
        />
        <Select
          label="Week starts on"
          value={String(settings.week_start)}
          disabled={busy}
          options={[
            { value: '1', label: 'Monday' },
            { value: '0', label: 'Sunday' },
          ]}
          onChange={(e) =>
            void run({
              type: 'settings.update',
              payload: { week_start: Number(e.target.value) as 0 | 1 },
            })
          }
        />
      </div>
      <p className="text-muted text-xs">
        Late nights before this hour still count as the previous day. Past days never move.
      </p>
      <Alert text={error} />
    </Card>
  );
}

export function WakeSection({ settings }: { settings: Settings }) {
  const { run, busy, error } = useAction();
  const [draft, setDraft] = useState({
    wake_time: settings.wake_time,
    wake_window_min: settings.wake_window_min,
    wake_late_cutoff: settings.wake_late_cutoff,
  });
  const changed =
    draft.wake_time !== settings.wake_time ||
    draft.wake_window_min !== settings.wake_window_min ||
    draft.wake_late_cutoff !== settings.wake_late_cutoff;
  const windowOk =
    Number.isInteger(draft.wake_window_min) &&
    draft.wake_window_min >= 5 &&
    draft.wake_window_min <= 120;

  return (
    <Card title="Wake-up">
      <div className="grid gap-3 sm:grid-cols-3">
        <TextInput
          label="Wake-up time"
          type="time"
          value={draft.wake_time}
          onChange={(e) => e.target.value && setDraft({ ...draft, wake_time: e.target.value })}
        />
        <TextInput
          label="On-time window (minutes)"
          type="number"
          inputMode="numeric"
          min={5}
          max={120}
          value={draft.wake_window_min}
          onChange={(e) => setDraft({ ...draft, wake_window_min: Number(e.target.value) })}
        />
        <TextInput
          label="Late check-in until"
          type="time"
          value={draft.wake_late_cutoff}
          onChange={(e) =>
            e.target.value && setDraft({ ...draft, wake_late_cutoff: e.target.value })
          }
        />
      </div>
      {windowOk && (
        <p className="text-muted text-sm">
          On time until {formatTime(addMinutes(draft.wake_time, draft.wake_window_min))}; late
          check-in until {formatTime(draft.wake_late_cutoff)}.
        </p>
      )}
      {!windowOk && <Alert text="The window must be 5–120 minutes." />}
      <Button
        className="self-start"
        disabled={busy || !changed || !windowOk}
        onClick={() => void run({ type: 'settings.update', payload: draft })}
      >
        Save wake-up times
      </Button>
      <Alert text={error} />
    </Card>
  );
}

export function CoreSection() {
  const habits = useHabits((s) => s.habits);
  const core = habits.filter((h) => h.status === 'active' && h.core);
  return (
    <Card title="Core quests">
      <p className="text-sm">
        Doing at least the minimum of every core quest makes a day active. Up to{' '}
        {GAME.maxCoreHabits}.
      </p>
      {core.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {core.map((h) => (
            <li key={h.id} className="flex items-center gap-2">
              <Star aria-hidden size={16} className="text-warning-text" fill="currentColor" />
              {h.title}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted text-sm">No core quests yet — every day is neutral.</p>
      )}
      <Link to="/quests" className="text-accent-text min-h-11 self-start py-2 font-medium">
        Change core quests in Quests →
      </Link>
    </Card>
  );
}

export function DataSection() {
  const [rebuilding, setRebuilding] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const rebuild = async () => {
    setRebuilding(true);
    try {
      const r = await rebuildProgress();
      setResult(
        r.daysFixed === 0
          ? `All ${r.daysChecked} days checked — everything was already correct.`
          : `Checked ${r.daysChecked} days and corrected ${r.daysFixed}.`,
      );
    } catch (e) {
      logError(e, 'rebuild progress');
      setResult('Rebuild failed. Please try again.');
    } finally {
      setRebuilding(false);
    }
  };
  const reset = async () => {
    await deleteAllData();
    window.location.assign('/'); // start over at onboarding, not on Settings
  };

  return (
    <Card title="Data">
      <div className="flex flex-col gap-2">
        <Button
          variant="secondary"
          className="self-start"
          disabled={rebuilding}
          onClick={() => void rebuild()}
        >
          {rebuilding ? 'Rebuilding…' : 'Rebuild progress'}
        </Button>
        <p className="text-muted text-xs">
          Re-checks every day against its quests and recomputes streaks, level and stats. Safe to
          run any time.
        </p>
        {result && (
          <p role="status" className="text-sm">
            {result}
          </p>
        )}
      </div>
      <div className="border-border flex flex-col gap-2 border-t pt-4">
        {!confirmReset ? (
          <Button variant="secondary" className="self-start" onClick={() => setConfirmReset(true)}>
            Reset all data…
          </Button>
        ) : (
          <div
            role="alertdialog"
            aria-label="Reset all data?"
            className="bg-surface-2 flex flex-col gap-3 rounded-md p-3"
          >
            <p className="text-sm">
              This deletes every quest, day, XP and setting on this device and starts over with
              onboarding. It can’t be undone.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void reset()}>Delete everything</Button>
              <Button variant="secondary" onClick={() => setConfirmReset(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
