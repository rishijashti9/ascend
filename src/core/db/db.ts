import Dexie, { type EntityTable } from 'dexie';
import { DEFAULT_SETTINGS } from '@/config/defaults';
import { nowMs } from '@/core/time';
import { nextHlc } from './hlc';
import type {
  AchievementUnlocked,
  BodyLog,
  DayRecord,
  Dream,
  FocusSession,
  Habit,
  JobApplication,
  MainQuest,
  MetaEntry,
  Milestone,
  PendingAction,
  Photo,
  PlanHistory,
  PlanProposal,
  Profile,
  ProgressEntry,
  Quest,
  QuestInstance,
  Review,
  Settings,
  Skill,
  SkillEvidence,
  XpEvent,
} from './types';

/** Bump when the stored shape changes; add a `this.version(n)` block with an upgrade below. */
export const SCHEMA_VERSION = 1;

/**
 * Index definitions per schema version. Only indexed fields are listed; all other
 * fields are stored too. `&` = unique, `[a+b]` = compound index.
 * NEVER edit an old version's block — add a new version instead.
 */
const STORES_V1 = {
  profile: 'id',
  settings: 'id',
  dreams: 'id, status',
  main_quests: 'id, dream_id, status',
  milestones: 'id, main_quest_id, status',
  habits: 'id, status',
  quests: 'id, type, status, week_start, due_day',
  quest_instances: 'id, day, source_id, [source_id+day], status',
  progress_entries: 'id, quest_instance_id, day',
  days: 'id',
  focus_sessions: 'id, day, quest_instance_id',
  body_logs: 'id, day',
  photos: 'id, day',
  reviews: 'id, type, [type+period]',
  xp_events: 'id, &idempotency_key, day, ref_id',
  achievements_unlocked: 'id, &achievement_key',
  skills: 'id, branch, parent_id',
  skill_evidence: 'id, skill_id, day',
  job_applications: 'id, stage, follow_up_at',
  plan_history: 'id, goal_id, created_at',
  plan_proposals: 'id, status, goal_id',
  pending_actions: 'id, occurred_at',
  meta: 'id',
} as const;

export type TableName = keyof typeof STORES_V1;
export const ALL_TABLES = Object.keys(STORES_V1) as TableName[];

export class AscendDB extends Dexie {
  profile!: EntityTable<Profile, 'id'>;
  settings!: EntityTable<Settings, 'id'>;
  dreams!: EntityTable<Dream, 'id'>;
  main_quests!: EntityTable<MainQuest, 'id'>;
  milestones!: EntityTable<Milestone, 'id'>;
  habits!: EntityTable<Habit, 'id'>;
  quests!: EntityTable<Quest, 'id'>;
  quest_instances!: EntityTable<QuestInstance, 'id'>;
  progress_entries!: EntityTable<ProgressEntry, 'id'>;
  days!: EntityTable<DayRecord, 'id'>;
  focus_sessions!: EntityTable<FocusSession, 'id'>;
  body_logs!: EntityTable<BodyLog, 'id'>;
  photos!: EntityTable<Photo, 'id'>;
  reviews!: EntityTable<Review, 'id'>;
  xp_events!: EntityTable<XpEvent, 'id'>;
  achievements_unlocked!: EntityTable<AchievementUnlocked, 'id'>;
  skills!: EntityTable<Skill, 'id'>;
  skill_evidence!: EntityTable<SkillEvidence, 'id'>;
  job_applications!: EntityTable<JobApplication, 'id'>;
  plan_history!: EntityTable<PlanHistory, 'id'>;
  plan_proposals!: EntityTable<PlanProposal, 'id'>;
  pending_actions!: EntityTable<PendingAction, 'id'>;
  meta!: EntityTable<MetaEntry, 'id'>;

  constructor(name = 'ascend') {
    super(name);
    this.version(1).stores(STORES_V1);
    // Future: this.version(2).stores({...}).upgrade(async (tx) => { ... });

    // First open on a new device: create default settings.
    this.on('populate', (tx) => {
      const at = new Date(nowMs()).toISOString();
      const settings: Settings = {
        id: 'settings',
        created_at: at,
        updated_at: at,
        deleted_at: null,
        schema_version: SCHEMA_VERSION,
        hlc: nextHlc(),
        ...DEFAULT_SETTINGS,
      };
      void tx.table('settings').add(settings);
    });
  }
}

/** The app's database. Tests create their own `new AscendDB(name)`. */
export const db = new AscendDB();
