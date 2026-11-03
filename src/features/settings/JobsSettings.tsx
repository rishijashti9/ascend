import type { Settings } from '@/core/db/types';
import { useAction } from '@/ui/hooks/useAction';
import { Switch } from '@/ui/Switch';
import { Card } from './sections';

/** The Job tracker stays hidden until switched on (SPEC 6.5: the job search is paused). */
export function JobsSettings({ settings }: { settings: Settings }) {
  const { run, busy, error } = useAction();
  return (
    <Card title="Job tracker">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium" id="jobs-label">
            Show the job tracker
          </p>
          <p className="text-muted text-sm">
            Track applications for jobs, internships and lab positions: stages, follow-ups and
            simple stats. Logging an application gives INT XP through a quest. Switching it off only
            hides it — nothing is deleted.
          </p>
        </div>
        <Switch
          on={settings.jobs_enabled}
          labelledBy="jobs-label"
          disabled={busy}
          onChange={(v) => void run({ type: 'settings.update', payload: { jobs_enabled: v } })}
        />
      </div>
      {error && (
        <p role="alert" className="text-warning-text text-sm">
          {error}
        </p>
      )}
    </Card>
  );
}
