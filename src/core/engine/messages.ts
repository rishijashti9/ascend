/**
 * The System message on Today (SPEC 6.1 rule engine): one short, calm line chosen by
 * priority from what's happening today. Pure, so every case is unit-tested.
 */
export interface MessageInput {
  /** "Day N" (day 1 = start day); null before the first day. */
  dayN: number | null;
  /** Local hour 0–23. */
  hour: number;
  streak: number;
  streakAtStart: number;
  coreTotal: number;
  coreDone: number;
  dailyTotal: number;
  dailyDone: number;
  dailyClear: boolean;
  lowEnergy: boolean;
  /** Just back after days the app wasn't opened. */
  welcome: { daysAway: number; shieldsUsed: number } | null;
  /** Today's Recovery quest, and the streak it restores (null = fresh start, no repair). */
  recovery: { done: boolean; restores: number | null } | null;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function systemMessage(m: MessageInput): string {
  if (m.dayN === null)
    return 'Your first day begins tomorrow. Rest well — the System will be ready.';
  const day = `Day ${m.dayN}.`;

  if (m.welcome && m.welcome.daysAway > 0) {
    const away = plural(m.welcome.daysAway, 'day');
    return m.welcome.shieldsUsed > 0
      ? `Welcome back. ${away} away — ${plural(m.welcome.shieldsUsed, 'shield')} covered part of it.`
      : `Welcome back after ${away}. No XP was lost. Start with one small quest.`;
  }
  if (m.recovery && !m.recovery.done) {
    return m.recovery.restores
      ? `Yesterday slipped. Clear the Recovery quest to restore your ${m.recovery.restores}-day streak.`
      : 'A fresh start. Clear the Recovery quest — ten minutes is enough.';
  }
  if (m.recovery?.done && m.recovery.restores) {
    return `Streak restored at ${plural(m.streakAtStart, 'day')}. Back on the path.`;
  }
  if (m.dailyClear) {
    // On a low-energy day the core minimums are all Daily Clear needs.
    return m.lowEnergy
      ? 'Minimums met — Daily Clear on a low-energy day. Rest is part of the climb.'
      : `Daily Clear. Every quest done — ${day.slice(0, -1)} is complete.`;
  }
  if (m.coreTotal > 0 && m.coreDone === m.coreTotal) {
    const left = m.dailyTotal - m.dailyDone;
    return `Core quests done — today counts. ${plural(left, 'quest')} left for Daily Clear.`;
  }
  if (m.dayN === 1) return 'Day 1. The System is awake. Begin with one quest.';
  if (m.lowEnergy) return 'Low-energy day. The core minimums are enough — they still count.';
  if (m.streakAtStart > 0 && m.streakAtStart % 7 === 0) {
    return `${day} ${m.streakAtStart}-day streak. Keep it alive.`;
  }
  const coreLeft = m.coreTotal - m.coreDone;
  if (m.hour >= 18 && coreLeft > 0) {
    return `Evening. ${plural(coreLeft, 'core quest')} left to keep the streak.`;
  }
  const left = m.dailyTotal - m.dailyDone;
  const streak = m.streak > 0 ? ` Streak: ${plural(m.streak, 'day')}.` : '';
  return `${day} ${plural(left, 'quest')} waiting.${streak}`;
}
