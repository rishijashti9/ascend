import { backupReminderDue } from './reminder';

const NOW = Date.parse('2026-11-20T10:00:00.000Z');
const base = {
  native: false,
  startDay: '2026-11-02',
  today: '2026-11-20',
  lastExportAt: null,
  snoozeUntil: null,
  nowMs: NOW,
};

describe('backupReminderDue', () => {
  it('never exported: due after the first week', () => {
    expect(backupReminderDue(base)).toBe(true);
    expect(backupReminderDue({ ...base, startDay: '2026-11-15' })).toBe(false);
  });

  it('due when the last export is at least 7 days old', () => {
    expect(backupReminderDue({ ...base, lastExportAt: '2026-11-14T10:00:00.000Z' })).toBe(false);
    expect(backupReminderDue({ ...base, lastExportAt: '2026-11-13T10:00:00.000Z' })).toBe(true);
  });

  it('"Later" snoozes it; never in the Android app or before onboarding', () => {
    expect(backupReminderDue({ ...base, snoozeUntil: '2026-11-21T00:00:00.000Z' })).toBe(false);
    expect(backupReminderDue({ ...base, native: true })).toBe(false);
    expect(backupReminderDue({ ...base, startDay: null })).toBe(false);
  });
});
