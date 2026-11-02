import Dexie from 'dexie';
import { z } from 'zod';
import { AscendDB } from '@/core/db/db';
import { clearSubscribers, subscribe, subscribeAll, type DomainEvent } from './events';
import { ActionValidationError, recordAction } from './recordAction';
import { defineAction } from './registry';
import './index';

let db: AscendDB;

beforeEach(async () => {
  db = new AscendDB(`test-${crypto.randomUUID()}`);
  await db.open();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(async () => {
  clearSubscribers();
  db.close();
  await Dexie.delete(db.name);
});

// Test-only actions.
defineAction({
  type: 'test.award',
  schema: z.object({ key: z.string(), amount: z.number() }),
  tables: [],
  async run(ctx, { key, amount }) {
    const added = await ctx.addXpEvent({
      day: '2026-11-02',
      occurred_at: ctx.occurredAt,
      stat: 'INT',
      base_amount: amount,
      reason: 'quest_full',
      idempotency_key: key,
      ref_type: null,
      ref_id: null,
    });
    if (added) ctx.emit({ type: 'DayChanged', payload: { day: '2026-11-02' } });
    return added;
  },
});

defineAction({
  type: 'test.failsHalfway',
  schema: z.object({}),
  tables: ['settings'],
  async run(ctx) {
    await ctx.db.settings.update('settings', { wake_time: '09:00' });
    ctx.emit({ type: 'SettingsChanged', payload: { changed: ['wake_time'] } });
    throw new Error('something broke after the first write');
  },
});

describe('recordAction', () => {
  it('updates settings through the pipeline and bumps the HLC', async () => {
    const before = await db.settings.get('settings');
    const result = await recordAction(
      { type: 'settings.update', payload: { theme: 'dark' } },
      { db },
    );
    const after = await db.settings.get('settings');
    expect(after?.theme).toBe('dark');
    expect(after?.wake_time).toBe(before?.wake_time);
    expect((after?.hlc ?? '') > (before?.hlc ?? '')).toBe(true);
    expect(result.events).toEqual([{ type: 'SettingsChanged', payload: { changed: ['theme'] } }]);
  });

  it('merges nested notification settings instead of replacing them', async () => {
    await recordAction(
      { type: 'settings.update', payload: { notifications: { evening_time: '21:30' } } },
      { db },
    );
    const s = await db.settings.get('settings');
    expect(s?.notifications.evening_time).toBe('21:30');
    expect(s?.notifications.wake_checkin).toBe(true);
  });

  it('rejects invalid payloads and writes nothing', async () => {
    const before = await db.settings.get('settings');
    await expect(
      recordAction({ type: 'settings.update', payload: { wake_time: '25:00' } }, { db }),
    ).rejects.toBeInstanceOf(ActionValidationError);
    await expect(
      recordAction({ type: 'settings.update', payload: { unknown_field: 1 } }, { db }),
    ).rejects.toBeInstanceOf(ActionValidationError);
    await expect(recordAction({ type: 'settings.update', payload: {} }, { db })).rejects.toThrow(
      /nothing to change/,
    );
    expect(await db.settings.get('settings')).toEqual(before);
  });

  it('rejects unknown action types', async () => {
    await expect(recordAction({ type: 'nope', payload: {} }, { db })).rejects.toThrow(
      /unknown action type/,
    );
  });

  it('the same XP award written twice is stored once', async () => {
    const first = await recordAction<boolean>(
      { type: 'test.award', payload: { key: 'h1:2026-11-02:full:0', amount: 25 } },
      { db },
    );
    const second = await recordAction<boolean>(
      { type: 'test.award', payload: { key: 'h1:2026-11-02:full:0', amount: 25 } },
      { db },
    );
    expect(first.value).toBe(true);
    expect(second.value).toBe(false);
    expect(await db.xp_events.count()).toBe(1);
  });

  it('ignores a repeated action_id (widget/notification delivered twice)', async () => {
    const action = {
      type: 'test.award',
      payload: { key: 'k-unique', amount: 10 },
      action_id: 'widget-tap-123',
    };
    const first = await recordAction(action, { db });
    const second = await recordAction(action, { db });
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(second.events).toEqual([]);
  });

  it('keeps the real occurred_at time of a late-processed action', async () => {
    await recordAction(
      {
        type: 'test.award',
        payload: { key: 'late', amount: 10 },
        occurred_at: '2026-11-02T00:10:00.000Z',
        source: 'widget',
      },
      { db },
    );
    expect((await db.xp_events.toArray())[0]?.occurred_at).toBe('2026-11-02T00:10:00.000Z');
  });

  it('rolls back every write and emits nothing when an action fails', async () => {
    const seen: DomainEvent[] = [];
    subscribeAll((e) => {
      seen.push(e);
    });
    const before = await db.settings.get('settings');
    await expect(recordAction({ type: 'test.failsHalfway', payload: {} }, { db })).rejects.toThrow(
      'something broke',
    );
    expect(await db.settings.get('settings')).toEqual(before);
    expect(seen).toEqual([]);
  });
});

describe('event bus', () => {
  it('delivers events to typed and catch-all subscribers after commit', async () => {
    const typed = vi.fn();
    const all = vi.fn();
    subscribe('SettingsChanged', typed);
    subscribeAll(all);
    await recordAction({ type: 'settings.update', payload: { auto_plan: true } }, { db });
    expect(typed).toHaveBeenCalledWith({ changed: ['auto_plan'] });
    expect(all).toHaveBeenCalledWith({
      type: 'SettingsChanged',
      payload: { changed: ['auto_plan'] },
    });
  });

  it('a failing subscriber does not stop the others or undo the write', async () => {
    const after = vi.fn();
    subscribe('SettingsChanged', () => {
      throw new Error('subscriber bug');
    });
    subscribe('SettingsChanged', after);
    await recordAction({ type: 'settings.update', payload: { photo_sync: false } }, { db });
    expect(after).toHaveBeenCalledOnce();
    expect((await db.settings.get('settings'))?.photo_sync).toBe(false);
  });

  it('unsubscribe stops delivery', async () => {
    const handler = vi.fn();
    const off = subscribe('SettingsChanged', handler);
    off();
    await recordAction({ type: 'settings.update', payload: { theme: 'light' } }, { db });
    expect(handler).not.toHaveBeenCalled();
  });
});
