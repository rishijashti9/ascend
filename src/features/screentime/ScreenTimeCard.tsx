import { Smartphone, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { screenBridge } from '@/app/screenTime';
import type { IncidentKind } from '@/core/db/types';
import { INCIDENT_TEXT } from '@/core/screentime/integrity';
import { formatMinutes } from '@/core/screentime/observe';
import { useScreen } from '@/core/state/screen';
import { Button } from '@/ui/Button';
import { useAction } from '@/ui/hooks/useAction';
import { LimitEditor } from './LimitEditor';
import { shortDate } from './format';

/**
 * Screen time on Today (SPEC 6.8): a banner while something that keeps the reminders working is
 * switched off during a lock; the observe week's quiet note; the one suggestion card after it;
 * then simply today vs the limit. (TodayPage shows it only while the `screenTime` flag is on.)
 */
export function ScreenTimeToday() {
  const rules = useScreen((s) => s.rules);
  if (!rules?.enabled) return null;
  return (
    <>
      <IncidentBanner />
      <ScreenTimeCard />
    </>
  );
}

function fix(kind: IncidentKind) {
  return kind === 'usage_access_off'
    ? screenBridge.openUsageAccess()
    : screenBridge.openNotificationSettings();
}

export function IncidentBanner() {
  const incidents = useScreen((s) => s.incidents);
  const lockEnd = useScreen((s) => s.lock.endMs);
  if (incidents.length === 0) return null;
  const kinds = [...new Set(incidents.map((i) => i.incident).filter(Boolean))] as IncidentKind[];
  return (
    <div
      role="region"
      aria-label="Screen-time reminders are off"
      className="panel outline-warning flex flex-col gap-3 p-4 outline-2"
    >
      {kinds.map((k) => (
        <p key={k} className="flex items-start gap-2 text-sm">
          <TriangleAlert aria-hidden size={18} className="text-warning-text mt-0.5 shrink-0" />
          <span>
            <span className="font-medium">{INCIDENT_TEXT[k].title}.</span> Your limit is locked, so
            the lock now runs 7 days longer
            {lockEnd ? ` — until ${shortDate(lockEnd)}` : ''}. No XP is lost.
          </span>
        </p>
      ))}
      <div className="flex flex-wrap gap-2">
        {kinds.map((k) => (
          <Button key={k} variant="secondary" onClick={() => void fix(k).catch(() => undefined)}>
            {INCIDENT_TEXT[k].fix}
          </Button>
        ))}
      </div>
    </div>
  );
}

function ScreenTimeCard() {
  const observe = useScreen((s) => s.observe);
  const suggestion = useScreen((s) => s.suggestion);
  const { run, busy, error } = useAction();
  const [editing, setEditing] = useState(false);

  const box = 'panel flex flex-col gap-3 p-4';

  if (observe.phase === 'observing' || observe.phase === 'waiting_for_data') {
    return (
      <p className="text-muted flex items-center gap-2 text-sm" role="status">
        <Smartphone aria-hidden size={16} className="shrink-0" />
        {observe.phase === 'observing'
          ? `Screen time: observing quietly — day ${observe.day} of 7. No reminders yet.`
          : 'Screen time: a few more days of readings, then one suggestion.'}
      </p>
    );
  }

  if (observe.phase === 'ready' && suggestion) {
    return (
      <section aria-label="Screen time suggestion" className={box}>
        <p className="text-sm">
          You average <span className="font-medium">{formatMinutes(suggestion.averageMin)}</span> of
          entertainment a day. Set your daily limit to{' '}
          <span className="font-medium">{suggestion.limitMin} min</span>?
        </p>
        {editing ? (
          <LimitEditor initial={suggestion.limitMin} onDone={() => setEditing(false)} />
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy}
              onClick={() =>
                void run({ type: 'screen.setLimit', payload: { limit_min: suggestion.limitMin } })
              }
            >
              Accept
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => setEditing(true)}>
              Edit
            </Button>
          </div>
        )}
        <p className="text-muted text-xs">
          Accepting locks the limit for 1 week: you can always lower it; raising it waits until the
          week is over. Reminders never block anything.
        </p>
        {error && (
          <p role="alert" className="text-warning-text text-sm">
            {error}
          </p>
        )}
      </section>
    );
  }

  // Once the limit is set, Today's Screen time tile shows today vs the limit (Phase 12).
  return null;
}
