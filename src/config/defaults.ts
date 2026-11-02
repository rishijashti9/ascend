import type { BaseRecord, Settings } from '@/core/db/types';

/** Default settings, pre-filled from Rishi's answers (DECISIONS.md). */
export const DEFAULT_SETTINGS: Omit<Settings, keyof BaseRecord> = {
  day_start_hour: 3,
  week_start: 1, // Monday
  wake_time: '05:00',
  wake_window_min: 20,
  wake_late_cutoff: '07:00',
  theme: 'system',
  notifications: {
    wake_checkin: true,
    morning_briefing: true,
    quest_reminders: true,
    evening_winddown: true,
    evening_time: '21:00',
    job_followups: true,
    browser_notifications: false,
  },
  quiet_hours: { start: '22:00', end: '04:45' },
  focus_presets: [
    { work_min: 25, break_min: 5 },
    { work_min: 50, break_min: 10 },
  ],
  ai_enabled: false,
  ai_monthly_budget: 5,
  auto_plan: false,
  health_connect_enabled: false,
  photo_sync: false,
  jobs_enabled: false,
};
