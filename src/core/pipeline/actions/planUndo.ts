import { z } from 'zod';
import type { TableName } from '@/core/db/db';
import type { BaseRecord, PlanChange } from '@/core/db/types';
import { refreshDayRecord } from '../days';
import { appDayOf, ensureInstancesForDay } from '../helpers';
import { touch } from '../records';
import { defineAction, RuleError } from '../registry';
import { PLAN_TABLES } from './planApply';

/**
 * Exact undo of an applied plan (SPEC 6.3: Plan history). Every record the plan touched goes
 * back to how it was before: records the plan created are soft-deleted (history stays), changed
 * records get their old values back. If any of them was changed after the plan (completed,
 * edited), undo is refused — it couldn't be exact any more. XP already earned is never removed.
 */
type Row = BaseRecord & Record<string, unknown>;

/** Same record content, ignoring write metadata (a re-save with no change isn't an edit). */
const META = new Set(['hlc', 'updated_at', 'schema_version']);
function sameContent(a: Row, b: Row): boolean {
  const strip = (r: Row) =>
    JSON.stringify(
      Object.keys(r)
        .sort()
        .filter((k) => !META.has(k))
        .map((k) => [k, r[k]]),
    );
  return strip(a) === strip(b);
}

export const undoPlan = defineAction({
  type: 'plan.undo',
  schema: z.object({ id: z.string().min(1) }).strict(),
  tables: PLAN_TABLES,
  async run(ctx, { id }) {
    const history = await ctx.db.plan_history.get(id);
    if (!history || history.deleted_at) throw new RuleError('That plan no longer exists');
    if (history.undone_at) throw new RuleError('This plan was already undone');
    const at = ctx.processedAt;
    const today = await appDayOf(ctx.db, at);

    // The state right after the plan, per record (its last change wins).
    const last = new Map<string, PlanChange>();
    for (const c of history.changes) last.set(`${c.entity}|${c.id}`, c);
    // Later System changes that are still in place (e.g. a carried copy removed because its
    // original was finished) don't block an exact undo: their result is allowed too.
    const later = (await ctx.db.plan_history.toArray()).filter(
      (h) => h.id !== id && !h.undone_at && !h.deleted_at && h.created_at >= history.created_at,
    );
    for (const c of last.values()) {
      const current = (await ctx.db.table(c.entity).get(c.id)) as Row | undefined;
      const after = c.after as Row | null;
      const allowed = [
        after,
        ...later.flatMap((h) =>
          h.changes
            .filter((x) => x.entity === c.entity && x.id === c.id)
            .map((x) => x.after as Row | null),
        ),
      ];
      if (after && current && !allowed.some((a) => a && sameContent(current, a))) {
        const name = typeof current.title === 'string' ? `“${current.title}”` : 'Something';
        throw new RuleError(`${name} was changed after this plan, so it can’t be undone exactly.`);
      }
    }

    let habitsTouched = false;
    for (const c of [...history.changes].reverse()) {
      const table = ctx.db.table(c.entity as TableName);
      const current = (await table.get(c.id)) as Row | undefined;
      if (!current) continue;
      if (c.entity === 'habits') habitsTouched = true;
      if (c.before === null) {
        // Created by the plan → soft-delete (archived habits leave no open quests behind).
        await table.put({
          ...current,
          ...(c.entity === 'habits' ? { status: 'archived' } : {}),
          ...(c.entity === 'quests' ? { status: 'archived' } : {}),
          deleted_at: at,
          ...touch(at),
        });
        if (c.entity === 'habits') {
          for (const inst of await ctx.db.quest_instances
            .where('source_id')
            .equals(c.id)
            .toArray()) {
            if (inst.status === 'pending' && inst.deleted_at === null) {
              await ctx.db.quest_instances.put({ ...inst, deleted_at: at, ...touch(at) });
            }
          }
        }
      } else {
        await table.put({ ...(c.before as Row), ...touch(at) });
      }
    }
    // A daily quest brought back (e.g. a pause undone) gets today's quest again.
    if (habitsTouched && (await ctx.db.quest_instances.where('day').equals(today).count()) > 0) {
      await ensureInstancesForDay(ctx.db, today);
    }
    await refreshDayRecord(ctx.db, today, at);

    await ctx.db.plan_history.put({ ...history, undone_at: at, ...touch(at) });
    ctx.emit({ type: 'PlanUndone', payload: { historyId: id } });
    return true;
  },
});
