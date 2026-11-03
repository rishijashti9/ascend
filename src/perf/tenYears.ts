import type { AscendDB } from '@/core/db/db';
import type {
  BodyLog,
  FocusSession,
  Habit,
  ProgressEntry,
  QuestInstance,
  Review,
  XpEvent,
} from '@/core/db/types';
import { buildHabitInstance } from '@/core/engine/instances';
import { newBase } from '@/core/pipeline';
import { addDays, instantAt } from '@/core/time';
import { habitFieldsOf, STARTER_HABITS } from '@/data/starter';

/**
 * Ten years of realistic history, written straight into the database (task 10.6). Real actions
 * would take hours for 3,650 days; bulk records with the same shapes are what the screens and
 * the startup path have to read, which is what this measures. Seeded, so runs compare.
 */
export interface Generated {
  startDay: string;
  today: string;
  counts: Record<string, number>;
}

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export async function generateTenYears(
  db: AscendDB,
  today: string,
  years = 10,
): Promise<Generated> {
  const random = rng(42);
  const startDay = addDays(today, -365 * years);
  const at = (day: string, hhmm: string) =>
    new Date(instantAt(day, hhmm, 'Asia/Kolkata')).toISOString();

  const habits: Habit[] = STARTER_HABITS.filter((h) => h.selected).map((h, order) => ({
    ...newBase(`habit-${h.key}`, at(startDay, '10:00')),
    ...habitFieldsOf(h),
    schedule: [0, 1, 2, 3, 4, 5, 6],
    skill_ids: [],
    planned_by: 'me',
    linked_goal_type: null,
    linked_goal_id: null,
    status: 'active',
    order,
  })) as Habit[];
  await db.habits.bulkAdd(habits);
  await db.profile.put({
    ...newBase('profile'),
    name: 'Rishi',
    start_day: startDay,
    onboarded_at: at(startDay, '10:00'),
    display_title: null,
  });

  const instances: QuestInstance[] = [];
  const entries: ProgressEntry[] = [];
  const xp: XpEvent[] = [];
  const sessions: FocusSession[] = [];
  const body: BodyLog[] = [];
  const reviews: Review[] = [];

  for (let day = startDay; day < today; day = addDays(day, 1)) {
    const away = random() < 0.04; // a few missed days
    for (const h of habits) {
      const i = buildHabitInstance(h, day, newBase(undefined, at(day, '04:00')));
      const roll = random();
      const status = away
        ? 'missed'
        : roll < 0.75
          ? 'done_full'
          : roll < 0.9
            ? 'done_min'
            : 'missed';
      i.status = status;
      if (status !== 'missed') {
        i.completed_at = at(day, '19:00');
        i.completed_via = 'tap';
        const base = { easy: 10, normal: 25, hard: 50, epic: 100 }[h.difficulty];
        xp.push({
          ...newBase(undefined, i.completed_at),
          day,
          occurred_at: i.completed_at,
          stat: h.stat,
          base_amount: status === 'done_full' ? base : base / 2,
          reason: status === 'done_full' ? 'quest_full' : 'quest_min',
          idempotency_key: `${i.id}:${status === 'done_full' ? 'full' : 'min'}:0`,
          ref_type: 'quest_instance',
          ref_id: i.id,
        });
        if (h.measure !== 'check') {
          const amount = status === 'done_full' ? (h.target_value ?? 1) : (h.min_value ?? 1);
          entries.push({
            ...newBase(undefined, i.completed_at),
            quest_instance_id: i.id,
            day,
            source: 'manual',
            amount,
            occurred_at: i.completed_at,
            ref_id: null,
          });
        }
      }
      instances.push(i);
    }
    if (!away && random() < 0.7) {
      sessions.push({
        ...newBase(undefined, at(day, '06:00')),
        quest_instance_id: null,
        stat: 'INT',
        skill_ids: [],
        planned_min: 50,
        break_min: 10,
        actual_min: 50,
        completed: true,
        face_down: true,
        started_at: at(day, '06:00'),
        ended_at: at(day, '06:50'),
        day,
      });
    }
    if (!away) {
      body.push({
        ...newBase(`body:${day}`, at(day, '21:00')),
        day,
        weight: 75 + random() * 3,
        waist: null,
        sleep_hours: 6 + random() * 2,
        steps: Math.round(3000 + random() * 8000),
        workout_notes: null,
        photo_id: null,
        source: 'manual',
        manual_override: true,
      });
    }
    if (!away && random() < 0.5) {
      reviews.push({
        ...newBase(`review:daily:${day}`, at(day, '21:30')),
        type: 'daily',
        period: day,
        energy: 3,
        mood: 4,
        win: 'Study block done',
        lesson: null,
        text: null,
        answers: {},
      });
    }
  }
  await db.quest_instances.bulkAdd(instances);
  await db.progress_entries.bulkAdd(entries);
  await db.xp_events.bulkAdd(xp);
  await db.focus_sessions.bulkAdd(sessions);
  await db.body_logs.bulkAdd(body);
  await db.reviews.bulkAdd(reviews);
  return {
    startDay,
    today,
    counts: {
      days: 365 * years,
      quest_instances: instances.length,
      progress_entries: entries.length,
      xp_events: xp.length,
      focus_sessions: sessions.length,
      body_logs: body.length,
      reviews: reviews.length,
    },
  };
}

/** Runs `fn` and returns how long it took in ms. */
export async function time<T>(fn: () => Promise<T>): Promise<number> {
  const t0 = performance.now();
  await fn();
  return Math.round(performance.now() - t0);
}
