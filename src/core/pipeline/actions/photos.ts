import { z } from 'zod';
import type { Photo } from '@/core/db/types';
import { appDayOf } from '../helpers';
import { newBase, touch } from '../records';
import { defineAction, RuleError } from '../registry';
import { bodyLogId, emptyBodyLog } from './bodySync';

/**
 * Body photos (SPEC 7.6, DECISIONS): kept on this device only — never synced and never in the
 * JSON export (only in "Export with photos"). One photo per day, linked from that day's body
 * log. Deleting a photo really removes it (privacy and space), unlike other records.
 */
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const image = z
  .instanceof(Blob)
  .refine((b) => b.size > 0 && b.size <= 15_000_000, 'image too large');
const TABLES = ['photos', 'body_logs', 'settings'] as const;

export const addPhoto = defineAction({
  type: 'photo.add',
  schema: z
    .object({ day: day.optional(), blob: image, mime: z.string().default('image/jpeg') })
    .strict(),
  tables: [...TABLES],
  async run(ctx, p) {
    const today = await appDayOf(ctx.db, ctx.occurredAt);
    const d = p.day ?? today;
    if (d > today) throw new RuleError('That day hasn’t happened yet');
    const log = (await ctx.db.body_logs.get(bodyLogId(d))) ?? emptyBodyLog(d, ctx.processedAt);
    // One photo per day: a new one replaces the old.
    if (log.photo_id) await ctx.db.photos.delete(log.photo_id);
    const photo: Photo = {
      ...newBase(undefined, ctx.processedAt),
      day: d,
      blob: p.blob,
      mime: p.mime,
    };
    await ctx.db.photos.add(photo);
    await ctx.db.body_logs.put({
      ...log,
      photo_id: photo.id,
      deleted_at: null,
      ...touch(ctx.processedAt),
    });
    ctx.emit({ type: 'BodyLogged', payload: { day: d } });
    return photo.id;
  },
});

export const deletePhoto = defineAction({
  type: 'photo.delete',
  schema: z.object({ id: z.string().min(1) }).strict(),
  tables: [...TABLES],
  async run(ctx, { id }) {
    const photo = await ctx.db.photos.get(id);
    if (!photo) throw new RuleError('That photo is already gone');
    await ctx.db.photos.delete(id);
    const log = await ctx.db.body_logs.get(bodyLogId(photo.day));
    if (log?.photo_id === id) {
      await ctx.db.body_logs.put({ ...log, photo_id: null, ...touch(ctx.processedAt) });
    }
    ctx.emit({ type: 'BodyLogged', payload: { day: photo.day } });
  },
});

/** Restores photos from an "Export with photos" file (skips ones already on this device). */
export const restorePhotos = defineAction({
  type: 'photo.restore',
  schema: z
    .object({
      photos: z
        .array(z.object({ id: z.string().min(1), day, mime: z.string(), blob: image }).strict())
        .max(5000),
    })
    .strict(),
  tables: [...TABLES],
  async run(ctx, { photos }) {
    let added = 0;
    for (const p of photos) {
      if (await ctx.db.photos.get(p.id)) continue;
      await ctx.db.photos.add({
        ...newBase(p.id, ctx.processedAt),
        day: p.day,
        mime: p.mime,
        blob: p.blob,
      });
      const log =
        (await ctx.db.body_logs.get(bodyLogId(p.day))) ?? emptyBodyLog(p.day, ctx.processedAt);
      if (!log.photo_id || !(await ctx.db.photos.get(log.photo_id))) {
        await ctx.db.body_logs.put({ ...log, photo_id: p.id, ...touch(ctx.processedAt) });
      }
      added++;
    }
    if (added) ctx.emit({ type: 'BodyLogged', payload: { day: photos[0]?.day ?? '' } });
    return added;
  },
});
