import { nextHlc } from '@/core/db/hlc';
import { SCHEMA_VERSION } from '@/core/db/db';
import type { BaseRecord, IsoTime } from '@/core/db/types';
import { nowMs } from '@/core/time';

export function isoNow(): IsoTime {
  return new Date(nowMs()).toISOString();
}

/** Base fields for a brand-new record. `id` defaults to a new UUID. */
export function newBase(id: string = crypto.randomUUID(), at: IsoTime = isoNow()): BaseRecord {
  return {
    id,
    created_at: at,
    updated_at: at,
    deleted_at: null,
    schema_version: SCHEMA_VERSION,
    hlc: nextHlc(),
  };
}

/** Fields to set on every update of an existing record. */
export function touch(
  at: IsoTime = isoNow(),
): Pick<BaseRecord, 'updated_at' | 'schema_version' | 'hlc'> {
  return { updated_at: at, schema_version: SCHEMA_VERSION, hlc: nextHlc() };
}
