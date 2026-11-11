import { useEffect } from 'react';
import { createStore, useStore } from 'zustand';
import { db } from '@/core/db/db';
import { suggestLinks } from '@/core/planner/links';
import { LINKS_NEVER, LINKS_SNOOZE_KEY } from '@/core/pipeline/actions/links';
import { useAppState } from '@/core/state/app';
import { useGoals } from '@/core/state/goals';
import { useHabits } from '@/core/state/habits';
import { useToday } from '@/core/state/today';

/** State behind the "Link your daily quests" card (linking plan L2). */

/** This device's "Not now" / "Don't ask again" (null = never answered). */
const snoozeStore = createStore<{ loaded: boolean; until: string | null }>(() => ({
  loaded: false,
  until: null,
}));

export async function loadLinkSnooze() {
  const v = (await db.meta.get(LINKS_SNOOZE_KEY))?.value;
  snoozeStore.setState({ loaded: true, until: typeof v === 'string' ? v : null });
}

/** The card's suggestions, whether it should show, and today's applied entry (for Undo). */
export function useLinkCard() {
  const habits = useHabits((s) => s.habits);
  const mainQuests = useGoals((s) => s.mainQuests);
  const milestones = useGoals((s) => s.milestones);
  const history = useGoals((s) => s.history);
  const day = useToday((s) => s.day);
  const startDay = useAppState((s) => s.profile?.start_day ?? null);
  const snooze = useStore(snoozeStore);
  useEffect(() => {
    if (!snooze.loaded) void loadLinkSnooze();
  }, [snooze.loaded]);

  const suggestions = suggestLinks(habits, mainQuests, milestones);
  const withLink = suggestions.filter((s) => s.mainQuestId !== null);
  const applied = history.find((h) => !h.undone_at && day !== null && h.trigger === `links:${day}`);
  const snoozed =
    snooze.until === LINKS_NEVER || (snooze.until !== null && day !== null && day < snooze.until);
  // Not on Day 1: that day belongs to planning the goals from onboarding (UX-3), and this card
  // sits before the goal nudges in the slot. From Day 2 it shows once, until answered.
  const dayOne = startDay === null || day === null || day <= startDay;
  const visible = !!applied || (snooze.loaded && !snoozed && !dayOne && withLink.length > 0);
  return { visible, suggestions, applied };
}
