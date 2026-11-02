import { useEffect, useState } from 'react';
import type { FocusSession } from '@/core/db/types';
import { elapsedMinutes, timerPhase } from '@/core/engine/focus';
import { useToday } from '@/core/state/today';
import { Button } from '@/ui/Button';
import { useAction } from '@/ui/hooks/useAction';
import { useNow } from '@/ui/hooks/useNow';
import { STAT_META } from '@/ui/statMeta';

const mmss = (ms: number) => {
  const total = Math.ceil(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

/** Keep the screen on while focusing (where the browser allows it). */
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: { release: () => Promise<void> } | null = null;
    navigator.wakeLock
      .request('screen')
      .then((l) => {
        lock = l;
      })
      .catch(() => undefined);
    return () => void lock?.release().catch(() => undefined);
  }, [active]);
}

/** Minimal full-screen session (SPEC 4.6): the time, what it's for, and one way out. */
export function FocusRunner({ session }: { session: FocusSession }) {
  const now = useNow(1000);
  const { run, busy, error } = useAction();
  const [confirmEnd, setConfirmEnd] = useState(false);
  const quest = useToday((s) =>
    [...s.daily, ...s.week].find((q) => q.instance.id === session.quest_instance_id),
  );
  const { phase, remainingMs } = timerPhase(
    session.started_at,
    now,
    session.planned_min,
    session.break_min,
  );
  // Left the app and came back long after the end: ask instead of assuming.
  const longGone =
    phase === 'over' &&
    now - Date.parse(session.started_at) > (session.planned_min + session.break_min + 30) * 60_000;
  useWakeLock(phase === 'work');

  const forWhat = session.quest_instance_id
    ? (quest?.instance.title_snapshot ?? 'Linked quest')
    : `${session.stat ? STAT_META[session.stat].label : ''} · 1 XP per minute`;
  const finish = (payload: Record<string, unknown>) =>
    void run({ type: 'focus.finish', payload: { id: session.id, ...payload } });
  const elapsed = Math.min(session.planned_min, elapsedMinutes(session.started_at, now));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Focus session"
      className="bg-bg fixed inset-0 z-40 flex flex-col items-center justify-center gap-8 p-6 text-center"
    >
      <p className="text-muted text-sm tracking-wide uppercase">
        {phase === 'work' ? 'Focus' : phase === 'break' ? 'Break' : 'Done'}
      </p>
      <p className="text-lg">{forWhat}</p>
      {phase !== 'over' && (
        <p
          role="timer"
          aria-live="off"
          className="font-display text-[clamp(4rem,22vw,8rem)] leading-none font-semibold tabular-nums"
        >
          {mmss(remainingMs)}
        </p>
      )}

      {phase === 'work' && !confirmEnd && (
        <Button variant="ghost" onClick={() => setConfirmEnd(true)}>
          End early
        </Button>
      )}
      {phase === 'work' && confirmEnd && (
        <div
          role="alertdialog"
          aria-label="End the session now?"
          className="bg-surface-2 flex max-w-sm flex-col gap-3 rounded-lg p-4"
        >
          <p className="text-sm">
            {session.quest_instance_id
              ? `End now? ${elapsed} minute${elapsed === 1 ? '' : 's'} will count toward “${forWhat}”.`
              : 'End now? Unfinished sessions give no XP — no penalty either.'}
          </p>
          <div className="flex justify-center gap-2">
            <Button disabled={busy} onClick={() => finish({ completed: false })}>
              End now
            </Button>
            <Button variant="secondary" onClick={() => setConfirmEnd(false)}>
              Keep going
            </Button>
          </div>
        </div>
      )}

      {phase !== 'work' && !longGone && (
        <div className="flex max-w-sm flex-col gap-3">
          <p>{session.planned_min} minutes done. Was your phone face-down or out of reach?</p>
          <div className="flex justify-center gap-2">
            <Button disabled={busy} onClick={() => finish({ completed: true, face_down: true })}>
              Yes
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => finish({ completed: true, face_down: false })}
            >
              Not this time
            </Button>
          </div>
        </div>
      )}
      {longGone && (
        <div className="flex max-w-sm flex-col gap-3">
          <p>Did you finish your {session.planned_min}-minute session?</p>
          <div className="flex justify-center gap-2">
            <Button disabled={busy} onClick={() => finish({ completed: true })}>
              Yes, I did
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => finish({ completed: false, counted_min: 0 })}
            >
              No — don’t count it
            </Button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="text-warning-text text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
