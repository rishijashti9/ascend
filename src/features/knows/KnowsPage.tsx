import { Robot } from '@/ui/Robot';
import { ArrowLeft, Download, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { saveFile } from '@/app/files';
import {
  dailyOutcomesCsv,
  knownItems,
  learningEventsCsv,
  type KnownItem,
} from '@/core/adaptive/knows';
import { CONFIDENCE_LABEL } from '@/core/adaptive/model';
import { db } from '@/core/db/db';
import { useAdaptive } from '@/core/state/adaptive';
import { useHabits } from '@/core/state/habits';
import { Button } from '@/ui/Button';
import { useAction } from '@/ui/hooks/useAction';

const GROUPS: KnownItem['group'][] = ['Quests', 'Time', 'Load', 'Suggestions', 'Wellbeing'];

/**
 * "What the System knows about you" (SPEC 6.7 A): everything the Adaptive System has learned,
 * in plain words with its confidence. Any item can be cleared (it learns afresh from today),
 * one quest or everything can be reset, and the learning data can be exported as CSV.
 */
export function KnowsPage() {
  const state = useAdaptive((s) => s);
  const habits = useHabits((s) => s.habits);
  const items = knownItems(state, habits);
  const { run, busy, error } = useAction();
  const [confirmAll, setConfirmAll] = useState(false);

  const clear = (item: KnownItem) =>
    void run(
      item.clear.kind === 'reset'
        ? { type: 'learning.reset', payload: { habit_id: item.clear.habitId } }
        : { type: 'learning.forget', payload: { key: item.clear.key } },
    );

  const exportCsv = async (which: 'events' | 'outcomes') => {
    const stamp = state.input?.today ?? 'today';
    if (which === 'events') {
      const events = await db.learning_events.toArray();
      await saveFile(`ascend-learning-events-${stamp}.csv`, learningEventsCsv(events));
    } else if (state.input) {
      await saveFile(`ascend-daily-outcomes-${stamp}.csv`, dailyOutcomesCsv(state.input));
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <Link to="/me/stats" className="text-accent-text inline-flex min-h-11 items-center gap-1">
        <ArrowLeft aria-hidden size={18} /> Profile
      </Link>
      <header className="flex flex-col gap-1">
        <h1 className="display flex items-center gap-3 text-2xl">
          <Robot size={40} /> What the System knows about you
        </h1>
        <p className="text-muted text-sm">
          Learned on this device from numbers and patterns only — never your journal. It stays on
          this device and in your own synced account. Clearing an item makes it learn afresh from
          today; your history itself is never deleted.
        </p>
      </header>

      {items.length === 0 && (
        <p className="panel p-4">
          Nothing confident yet. After a couple of weeks of use, what the System learns appears
          here.
        </p>
      )}

      {GROUPS.map((group) => {
        const list = items.filter((i) => i.group === group);
        if (list.length === 0) return null;
        return (
          <section key={group} aria-label={group} className="flex flex-col gap-2">
            <h2 className="display text-muted text-sm">{group}</h2>
            <ul className="panel divide-border flex flex-col divide-y">
              {list.map((item) => (
                <li key={item.key} className="flex items-start gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {item.title}{' '}
                      <span className="text-muted text-xs font-normal">
                        · {CONFIDENCE_LABEL[item.confidence]}
                      </span>
                    </p>
                    <p className="text-muted text-sm">{item.text}</p>
                  </div>
                  <Button
                    variant="ghost"
                    className="px-3 text-sm"
                    disabled={busy}
                    aria-label={`Clear: ${item.title}`}
                    onClick={() => clear(item)}
                  >
                    Clear
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <section aria-label="Learning data" className="flex flex-col gap-2">
        <h2 className="display text-muted text-sm">Learning data</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void exportCsv('outcomes')}>
            <Download aria-hidden size={16} /> Daily outcomes (CSV)
          </Button>
          <Button variant="secondary" onClick={() => void exportCsv('events')}>
            <Download aria-hidden size={16} /> Learning events (CSV)
          </Button>
          {confirmAll ? (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() =>
                void run({ type: 'learning.reset', payload: { habit_id: null } }).then(() =>
                  setConfirmAll(false),
                )
              }
            >
              <RotateCcw aria-hidden size={16} /> Yes, reset all learning
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => setConfirmAll(true)}>
              <RotateCcw aria-hidden size={16} /> Reset all learning…
            </Button>
          )}
        </div>
        {confirmAll && (
          <p className="text-muted text-sm">
            Everything learned starts afresh from today. Quests, XP and history stay exactly as they
            are.
          </p>
        )}
      </section>
      {error && (
        <p role="alert" className="text-warning-text text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
