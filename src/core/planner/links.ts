import type { Habit, MainQuest, Milestone } from '@/core/db/types';

/**
 * "Link your daily quests" (linking plan L2, docs/product/LINKING-PLAN.md): for each active daily
 * quest that serves no goal yet, suggest the main quest it most likely serves — or none.
 *
 * Deterministic, offline and explainable: meaningful words shared between the quest's title and
 * the main quest's title or its milestones' titles. More shared words win; then the same stat;
 * then the title (alphabetical) so the result never depends on storage order. Other main quests
 * that share words are listed as alternatives, because a near-tie is a real choice for the person,
 * not something to decide silently. No shared word → no suggestion (never an invented link).
 */
export interface LinkSuggestion {
  habitId: string;
  title: string;
  /** The suggested main quest, or null when nothing fits. */
  mainQuestId: string | null;
  /** e.g. `shares “robotics”`; null when nothing fits. */
  why: string | null;
  /** Other main quests that share words too (ids), best first. */
  alsoFits: string[];
}

const STOP = new Set(
  (
    'a an and the of for to in on at by with from my your our this that daily weekly quest quests ' +
    'study studying phone free minutes min hour hours day days time every each up do done ' +
    'get make take go new more less'
  ).split(' '),
);

/** Lower-case words of 2+ letters/digits, without filler words. */
export function meaningfulWords(text: string): Set<string> {
  return new Set((text.toLowerCase().match(/[a-z0-9+#]{2,}/g) ?? []).filter((w) => !STOP.has(w)));
}

export function suggestLinks(
  habits: readonly Habit[],
  mainQuests: readonly MainQuest[],
  milestones: readonly Milestone[],
): LinkSuggestion[] {
  const live = mainQuests.filter((q) => q.status === 'active' && !q.deleted_at);
  const goalWords = new Map(
    live.map((q) => {
      const words = meaningfulWords(q.title);
      for (const m of milestones)
        if (m.main_quest_id === q.id && m.status !== 'archived' && !m.deleted_at)
          for (const w of meaningfulWords(m.title)) words.add(w);
      return [q.id, words] as const;
    }),
  );

  return habits
    .filter((h) => h.status === 'active' && !h.deleted_at && !h.linked_goal_id)
    .map((h) => {
      const words = meaningfulWords(h.title);
      const ranked = live
        .map((q) => {
          const shared = [...words].filter((w) => goalWords.get(q.id)?.has(w));
          return { q, shared };
        })
        .filter((r) => r.shared.length > 0)
        .sort(
          (a, b) =>
            b.shared.length - a.shared.length ||
            Number(b.q.stat === h.stat) - Number(a.q.stat === h.stat) ||
            a.q.title.localeCompare(b.q.title),
        );
      const best = ranked[0];
      return {
        habitId: h.id,
        title: h.title,
        mainQuestId: best?.q.id ?? null,
        why: best ? `shares ${best.shared.map((w) => `“${w}”`).join(' and ')}` : null,
        alsoFits: ranked.slice(1).map((r) => r.q.id),
      };
    });
}
