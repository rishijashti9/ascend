import { useState } from 'react';
import type { RuleResult } from '@/core/pipeline/actions/screenTime';
import { formatMinutes } from '@/core/screentime/observe';
import { Button } from '@/ui/Button';
import { Select } from '@/ui/Field';
import { useAction } from '@/ui/hooks/useAction';
import { shortDate } from './format';

/** 15-minute steps from 15 min to 6 h. */
const CHOICES = Array.from({ length: 24 }, (_, i) => (i + 1) * 15);

/**
 * Set or change the daily entertainment limit with its lock (1 week, or 1 month). During a lock a
 * lower limit applies at once; a higher one waits for the lock to end (the date is shown).
 */
export function LimitEditor({ initial, onDone }: { initial: number; onDone?: () => void }) {
  const [limit, setLimit] = useState(String(initial));
  const [lock, setLock] = useState<'week' | 'month'>('week');
  const [note, setNote] = useState<string | null>(null);
  const { runFor, busy, error } = useAction();

  async function save() {
    const r = await runFor<RuleResult>({
      type: 'screen.setLimit',
      payload: { limit_min: Number(limit), lock },
    });
    if (!r) return;
    if (r.deferred && r.lockEndMs) {
      setNote(
        `A higher limit waits for the lock to end — it applies on ${shortDate(r.lockEndMs)}.`,
      );
      return;
    }
    onDone?.();
  }

  return (
    <div className="flex flex-col gap-3">
      <Select
        label="Daily entertainment limit"
        value={limit}
        onChange={(e) => setLimit(e.target.value)}
        options={CHOICES.map((m) => ({ value: String(m), label: formatMinutes(m) }))}
      />
      <Select
        label="Lock it for"
        value={lock}
        onChange={(e) => setLock(e.target.value as 'week' | 'month')}
        options={[
          { value: 'week', label: '1 week' },
          { value: 'month', label: '1 month' },
        ]}
      />
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy} onClick={() => void save()}>
          Save limit
        </Button>
        {onDone && (
          <Button variant="ghost" disabled={busy} onClick={onDone}>
            Cancel
          </Button>
        )}
      </div>
      {note && (
        <p role="status" className="text-muted text-sm">
          {note}
        </p>
      )}
      {error && (
        <p role="alert" className="text-warning-text text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
