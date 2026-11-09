import { Link } from 'react-router';
import { APP_VERSION } from '@/app/version';
import { isEnabled } from '@/config/features';
import { useAppState } from '@/core/state/app';
import { AccountSection } from './AccountSection';
import { AskSettings } from './AskSettings';
import { BackupSection } from './BackupSection';
import { JobsSettings } from './JobsSettings';
import { HealthSettings } from './HealthSettings';
import { ScreenTimeSettings } from '@/features/screentime/ScreenTimeSettings';
import { NotificationSettings } from './NotificationSettings';
import { PlannerSettings } from './PlannerSettings';
import {
  AppearanceSection,
  Card,
  CoreSection,
  DataSection,
  DaySection,
  WakeSection,
} from './sections';

/** Settings (SPEC 7.11) — the parts that exist after Phase 2. Later phases add their own. */
export function SettingsPage() {
  const settings = useAppState((s) => s.settings);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <Link
        to="/me"
        className="text-accent-text inline-flex min-h-11 items-center self-start text-sm font-semibold lg:hidden"
      >
        ← Me
      </Link>
      <h1 className="display text-2xl">Settings</h1>
      {settings && (
        <>
          {isEnabled('sync') && <AccountSection />}
          <AppearanceSection settings={settings} />
          <DaySection settings={settings} />
          {/* Keyed so the form resets if the stored times change elsewhere. */}
          <WakeSection
            key={`${settings.wake_time}|${settings.wake_window_min}|${settings.wake_late_cutoff}`}
            settings={settings}
          />
          <CoreSection />
          {isEnabled('notifications') && <NotificationSettings settings={settings} />}
          {isEnabled('goals') && <PlannerSettings settings={settings} />}
          {isEnabled('ask') && <AskSettings settings={settings} />}
          {isEnabled('jobs') && <JobsSettings settings={settings} />}
          {isEnabled('health') && <HealthSettings settings={settings} />}
          {isEnabled('screenTime') && (
            <div id="screen-time">
              <ScreenTimeSettings />
            </div>
          )}
          {isEnabled('exportImport') && <BackupSection />}
          <DataSection />
        </>
      )}
      <Card title="About">
        <div className="flex items-center justify-between">
          <span>Version</span>
          <span className="text-muted tabular-nums">{APP_VERSION}</span>
        </div>
      </Card>
    </div>
  );
}
