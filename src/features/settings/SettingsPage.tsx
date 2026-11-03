import { APP_VERSION } from '@/app/version';
import { isEnabled } from '@/config/features';
import { useAppState } from '@/core/state/app';
import { AccountSection } from './AccountSection';
import { BackupSection } from './BackupSection';
import { JobsSettings } from './JobsSettings';
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
      <h1 className="text-xl font-semibold">Settings</h1>
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
          {isEnabled('jobs') && <JobsSettings settings={settings} />}
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
