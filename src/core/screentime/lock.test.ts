import { describe, expect, it } from 'vitest';
import {
  applyPending,
  changeRules,
  DAY_MS,
  extendedEnd,
  incidentEnd,
  laterLock,
  lockActive,
  lockNow,
  stricterRules,
  type RulesState,
} from './lock';

const T0 = Date.parse('2026-11-04T10:00:00Z');
const iso = (ms: number) => new Date(ms).toISOString();
const lock = (endMs: number) => ({ end_at: iso(endMs), deleted_at: null });

const base: RulesState = {
  enabled: true,
  reminders: true,
  limit_min: 60,
  added_apps: [],
  removed_apps: [],
  pending: null,
};

describe('lock end and trusted time', () => {
  it('ends only when the server time passes the end — never by the device clock alone', () => {
    const l = lock(T0 + 7 * DAY_MS);
    expect(lockActive(l, T0)).toBe(true);
    // No server time seen yet (offline since install): still locked, whatever the clock says.
    expect(lockActive(l, null)).toBe(true);
    expect(lockActive(l, T0 + 7 * DAY_MS)).toBe(false);
    expect(lockActive(null, T0)).toBe(false);
  });

  it('a clock moved back never shortens a new lock; ends only move later', () => {
    const trusted = T0;
    const deviceBack = T0 - 6 * DAY_MS;
    const now = lockNow(deviceBack, trusted);
    expect(now).toBe(T0);
    expect(extendedEnd(null, now, 'week')).toBe(T0 + 7 * DAY_MS);
    expect(extendedEnd(T0 + 20 * DAY_MS, now, 'week')).toBe(T0 + 20 * DAY_MS);
    expect(extendedEnd(T0 + 3 * DAY_MS, now, 'month')).toBe(T0 + 30 * DAY_MS);
  });

  it('each incident adds 7 days', () => {
    expect(incidentEnd(T0)).toBe(T0 + 7 * DAY_MS);
  });

  it('sync/import keep the copy that ends later', () => {
    const a = lock(T0 + DAY_MS);
    const b = lock(T0 + 2 * DAY_MS);
    expect(laterLock(a, b)).toBe(b);
    expect(laterLock(b, a)).toBe(b);
    expect(laterLock(undefined, a)).toBe(a);
  });
});

describe('changes during a lock', () => {
  it('lowering the limit applies at once; raising or deleting waits', () => {
    expect(changeRules(base, { kind: 'limit', limit_min: 45 }, true)).toEqual({
      rules: { ...base, limit_min: 45 },
      deferred: false,
    });
    const raised = changeRules(base, { kind: 'limit', limit_min: 90 }, true);
    expect(raised.deferred).toBe(true);
    expect(raised.rules.limit_min).toBe(60);
    expect(raised.rules.pending).toEqual({ limit_min: 90 });
    expect(changeRules(base, { kind: 'limit', limit_min: null }, true).deferred).toBe(true);
  });

  it('without a lock everything applies at once', () => {
    expect(changeRules(base, { kind: 'limit', limit_min: 90 }, false).rules.limit_min).toBe(90);
    expect(changeRules(base, { kind: 'reminders', on: false }, false).rules.reminders).toBe(false);
  });

  it('turning reminders or screen time off waits; turning on applies', () => {
    const off = changeRules(base, { kind: 'reminders', on: false }, true);
    expect(off).toMatchObject({
      deferred: true,
      rules: { reminders: true, pending: { reminders: false } },
    });
    const backOn = changeRules(off.rules, { kind: 'reminders', on: true }, true);
    expect(backOn).toMatchObject({ deferred: false, rules: { reminders: true, pending: null } });
    expect(changeRules(base, { kind: 'enabled', on: false }, true).deferred).toBe(true);
  });

  it('adding an app applies at once; removing one waits', () => {
    const added = changeRules(base, { kind: 'add_app', pkg: 'com.reddit.frontpage' }, true);
    expect(added).toMatchObject({
      deferred: false,
      rules: { added_apps: ['com.reddit.frontpage'] },
    });
    const removed = changeRules(
      added.rules,
      { kind: 'remove_app', pkg: 'com.reddit.frontpage' },
      true,
    );
    expect(removed.deferred).toBe(true);
    expect(removed.rules.added_apps).toEqual(['com.reddit.frontpage']);
    expect(removed.rules.pending).toEqual({ removed_apps: ['com.reddit.frontpage'] });
    // Adding it back cancels the waiting removal.
    const again = changeRules(
      removed.rules,
      { kind: 'add_app', pkg: 'com.reddit.frontpage' },
      true,
    );
    expect(again.rules.pending).toBeNull();
  });

  it('lowering after a waiting raise cancels the raise', () => {
    const raised = changeRules(base, { kind: 'limit', limit_min: 90 }, true).rules;
    const lowered = changeRules(raised, { kind: 'limit', limit_min: 45 }, true).rules;
    expect(lowered).toMatchObject({ limit_min: 45, pending: null });
  });

  it('waiting changes take effect when the lock ends', () => {
    let r = changeRules(base, { kind: 'limit', limit_min: 90 }, true).rules;
    r = changeRules(r, { kind: 'remove_app', pkg: 'com.cricbuzz.android' }, true).rules;
    r = changeRules(r, { kind: 'reminders', on: false }, true).rules;
    expect(applyPending(r)).toEqual({
      ...base,
      limit_min: 90,
      reminders: false,
      removed_apps: ['com.cricbuzz.android'],
      pending: null,
    });
  });

  it('importing an older backup can only make the rules stricter', () => {
    const current = { ...base, limit_min: 45, removed_apps: ['com.cricbuzz.android'] };
    const backup = { ...base, limit_min: 120, reminders: false, enabled: false, removed_apps: [] };
    expect(stricterRules(current, backup)).toMatchObject({
      limit_min: 45,
      reminders: true,
      enabled: true,
      removed_apps: [],
    });
  });
});
