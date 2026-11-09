import { Archive } from 'lucide-react';
import { useEffect, useState } from 'react';
import { exportBackup, exportWithPhotos } from '@/app/files';
import { monthStart, planCompaction } from '@/core/compaction/apply';
import { formatBytes } from '@/core/data/usage';
import { db } from '@/core/db/db';
import type { Compaction as CompactionRecord } from '@/core/db/types';
import { recordAction, subscribeAll } from '@/core/pipeline';
import { useToday } from '@/core/state/today';
import { addDays } from '@/core/time';
import { Button } from '@/ui/Button';
import { Card } from './sections';

const LABEL: Record<string, string> = {
  quest_instances: 'daily quests',
  progress_entries: 'progress entries',
  xp_events: 'XP records',
  focus_sessions: 'focus sessions',
  body_logs: 'body logs',
  plan_history: 'plan history entries',
  plan_proposals: 'old plan proposals',
  learning_events: 'learning records',
  photos: 'photos',
};

/** Above this many bytes of local data, a calm note suggests compacting. */
export const SIZE_NOTICE_BYTES = 25 * 1024 * 1024;

interface Preview {
  cutoff: string;
  counts: [string, number][];
  bytesSaved: number;
  months: number;
}

/**
 * Compaction (SPEC 6.7 D): keep a short summary, remove old detail. Choose a period, see
 * exactly what would be summarised and the space saved, then — after an automatic full
 * export — confirm. Progress stays exactly the same.
 */
export function Compaction({ totalBytes }: { totalBytes: number | null }) {
  const today = useToday((s) => s.day);
  const [years, setYears] = useState(1);
  const [photos, setPhotos] = useState<'keep' | 'remove'>('keep');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<CompactionRecord[]>([]);

  useEffect(() => {
    const load = () =>
      void db.compactions
        .toArray()
        .then((rows) =>
          setHistory(
            rows
              .filter((r) => !r.deleted_at)
              .sort((a, b) => b.created_at.localeCompare(a.created_at)),
          ),
        );
    load();
    return subscribeAll(load);
  }, []);

  if (!today) return null;
  const cutoff = monthStart(addDays(today, -365 * years));

  const makePreview = async () => {
    setMessage(null);
    const plan = await planCompaction(db, cutoff, photos === 'remove');
    const counts = Object.entries(plan.remove).flatMap(([t, ids]) =>
      ids?.length ? [[t, ids.length] as [string, number]] : [],
    );
    setPreview({ cutoff, counts, bytesSaved: plan.bytesSaved, months: plan.months.size });
  };

  const confirm = async () => {
    if (!preview) return;
    setBusy(true);
    setMessage(null);
    const saved = await (photos === 'remove'
      ? exportWithPhotos()
      : exportBackup('ascend-before-compaction'));
    if (saved !== 'saved') {
      setMessage('The export was cancelled, so nothing was changed.');
      setBusy(false);
      return;
    }
    try {
      await recordAction({
        type: 'data.compact',
        payload: { cutoff_day: preview.cutoff, remove_photos: photos === 'remove' },
      });
      setMessage(
        `Done — about ${formatBytes(preview.bytesSaved)} freed. Your progress is exactly the same.`,
      );
      setPreview(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
    setBusy(false);
  };

  return (
    <Card title="Compact old history">
      {totalBytes !== null && totalBytes > SIZE_NOTICE_BYTES && (
        <p className="text-sm">
          Your history is getting large ({formatBytes(totalBytes)}). Compacting old detail frees
          space and keeps every number that matters.
        </p>
      )}
      <p className="text-muted text-sm">
        Keeps a short monthly summary — XP, levels, ranks, streaks, completion rates, minutes, focus
        and skill hours, body averages, goals, reviews and reflections — and removes the old
        day-by-day detail. Your progress stays exactly the same.
      </p>
      <fieldset className="flex flex-col gap-1 text-sm">
        <legend>Compact detail older than</legend>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3].map((n) => (
            <Button
              key={n}
              variant={years === n ? 'primary' : 'secondary'}
              aria-pressed={years === n}
              onClick={() => {
                setYears(n);
                setPreview(null);
              }}
            >
              {n} year{n > 1 ? 's' : ''}
            </Button>
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-1 text-sm">
        <legend>Body photos from that time</legend>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={photos === 'keep' ? 'primary' : 'secondary'}
            aria-pressed={photos === 'keep'}
            onClick={() => {
              setPhotos('keep');
              setPreview(null);
            }}
          >
            Keep them
          </Button>
          <Button
            variant={photos === 'remove' ? 'primary' : 'secondary'}
            aria-pressed={photos === 'remove'}
            onClick={() => {
              setPhotos('remove');
              setPreview(null);
            }}
          >
            Remove them
          </Button>
        </div>
      </fieldset>
      {!preview ? (
        <Button variant="secondary" className="self-start" onClick={() => void makePreview()}>
          <Archive aria-hidden size={16} /> Show what would be compacted
        </Button>
      ) : preview.counts.length === 0 ? (
        <p className="text-sm">Nothing that old to compact yet.</p>
      ) : (
        <div className="flex flex-col gap-2 text-sm">
          <p>
            Before {preview.cutoff}: {preview.months} month{preview.months === 1 ? '' : 's'} would
            become summaries, removing:
          </p>
          <ul className="text-muted list-disc pl-5">
            {preview.counts.map(([t, n]) => (
              <li key={t}>
                {n.toLocaleString()} {LABEL[t] ?? t}
              </li>
            ))}
          </ul>
          <p>
            About {formatBytes(preview.bytesSaved)} saved. A full export
            {photos === 'remove' ? ' with photos' : ''} is saved first.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => void confirm()}>
              {busy ? 'Compacting…' : 'Export, then compact'}
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => setPreview(null)}>
              Not now
            </Button>
          </div>
        </div>
      )}
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      {history.length > 0 && (
        <div className="flex flex-col gap-1 text-sm">
          <h3 className="display text-muted">History</h3>
          <ul className="text-muted">
            {history.map((h) => (
              <li key={h.id}>
                {h.created_at.slice(0, 10)}: detail before {h.cutoff_day} summarised, about{' '}
                {formatBytes(h.bytes_saved)} saved{h.photos_removed ? ', photos removed' : ''}.
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
