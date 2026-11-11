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
import { SettingsGroup } from './SettingsGroup';
import {
  AppearanceSection,
  Card,
  CoreSection,
  DataSection,
  DaySection,
  WakeSection,
} from './sections';

/**
 * Settings (SPEC 7.11), in fold-out groups (UX-6): Account & sync · Appearance · Day & reminders ·
 * Quests & planning · Data & privacy, then About. Every control and its wording is unchanged.
 */
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
          {isEnabled('sync') && (
            <SettingsGroup
              id="sync"
              title="Account & sync"
              summary="Optional sign-in to keep your devices in sync"
              contains={['account']}
            >
              <AccountSection />
            </SettingsGroup>
          )}
          <SettingsGroup id="appearance" title="Appearance" summary="Effects, sound and vibration">
            <AppearanceSection settings={settings} />
          </SettingsGroup>
          <SettingsGroup
            id="day"
            title="Day & reminders"
            summary="When your day starts, wake-up, notifications, screen time"
            contains={['notifications', 'screen-time']}
          >
            <DaySection settings={settings} />
            {/* Keyed so the form resets if the stored times change elsewhere. */}
            <WakeSection
              key={`${settings.wake_time}|${settings.wake_window_min}|${settings.wake_late_cutoff}`}
              settings={settings}
            />
            {isEnabled('notifications') && <NotificationSettings settings={settings} />}
            {isEnabled('screenTime') && (
              <div id="screen-time">
                <ScreenTimeSettings />
              </div>
            )}
          </SettingsGroup>
          <SettingsGroup
            id="quests"
            title="Quests & planning"
            summary="Core quests, the Goal Planner, the job tracker, Health Connect"
          >
            <CoreSection />
            {isEnabled('goals') && <PlannerSettings settings={settings} />}
            {isEnabled('jobs') && <JobsSettings settings={settings} />}
            {isEnabled('health') && <HealthSettings settings={settings} />}
          </SettingsGroup>
          <SettingsGroup
            id="data"
            title="Data & privacy"
            summary="Ask the System, backups, your data"
          >
            {isEnabled('ask') && <AskSettings settings={settings} />}
            {isEnabled('exportImport') && <BackupSection />}
            <DataSection />
          </SettingsGroup>
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
