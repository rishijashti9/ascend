import { Flame, Sparkle } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useEffectsLevel } from '@/app/effects';
import { evaluateDay } from '@/core/engine/dayEval';
import { subscribe } from '@/core/pipeline';
import { useProgress } from '@/core/state/progress';
import { useToday } from '@/core/state/today';
import { Robot } from '@/ui/Robot';
import { Burst } from '@/ui/vfx/Burst';
import { dailyClearReached, streakMilestoneReached } from '@/ui/vfx/celebrations';

const HOLD_MS = 2600;
/** After an import, reset or sync, changes aren't "earned here" — stay quiet for a moment. */
const QUIET_MS = 5000;

type Banner = { key: number; kind: 'clear' } | { key: number; kind: 'streak'; days: number };

/** Sparkle spots around the banner (percent of its box) with staggered starts. */
const SPARKLES = [
  { left: '-4%', top: '10%', delay: 0 },
  { left: '8%', top: '-30%', delay: 180 },
  { left: '50%', top: '-38%', delay: 320 },
  { left: '92%', top: '-26%', delay: 120 },
  { left: '102%', top: '40%', delay: 260 },
  { left: '30%', top: '118%', delay: 420 },
  { left: '74%', top: '112%', delay: 60 },
];

/**
 * Daily Clear and streak-milestone moments (Phase 12 VFX): a banner drops in at the top, holds
 * and rises away, with sparkles and a burst on Full effects, fewer on Light, and just the banner
 * (no movement) on Off. Only changes seen while the app is open count.
 */
export function CelebrationLayer() {
  const level = useEffectsLevel();
  const clear = useToday((s) =>
    s.day
      ? evaluateDay(
          s.daily.map((q) => q.instance),
          s.lowEnergy,
        ).dailyClear
      : null,
  );
  const streak = useProgress((s) => s.progress?.streak.streak ?? null);
  const [banner, setBanner] = useState<Banner | null>(null);
  const prevClear = useRef<boolean | null>(null);
  const prevStreak = useRef<number | null>(null);
  const quietUntil = useRef(0);

  useEffect(() => {
    const quiet = () => {
      quietUntil.current = Date.now() + QUIET_MS;
    };
    const offs = [
      subscribe('DataImported', quiet),
      subscribe('DataReset', quiet),
      subscribe('DataSynced', quiet),
    ];
    return () => offs.forEach((off) => off());
  }, []);

  useEffect(() => {
    if (clear === null) return;
    const fire = dailyClearReached(prevClear.current, clear);
    prevClear.current = clear;
    if (fire && Date.now() >= quietUntil.current)
      setBanner((b) => (b?.kind === 'streak' ? b : { key: Date.now(), kind: 'clear' }));
  }, [clear]);

  useEffect(() => {
    if (streak === null) return;
    const days = streakMilestoneReached(prevStreak.current, streak);
    prevStreak.current = streak;
    // Daily Clear and a milestone on the same tap: the milestone (rarer) wins.
    if (days && Date.now() >= quietUntil.current)
      setBanner({ key: Date.now(), kind: 'streak', days });
  }, [streak]);

  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), HOLD_MS);
    return () => clearTimeout(t);
  }, [banner]);

  const moving = level !== 'off';
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 top-[max(1rem,env(safe-area-inset-top))] z-40 flex justify-center"
    >
      {banner && (
        <div
          key={banner.key}
          className={`relative ${moving ? 'vfx-banner' : ''}`}
          style={{ '--vfx-hold': `${HOLD_MS}ms` } as CSSProperties}
        >
          {moving && <Burst fireKey={banner.key} tone="celebrate" big />}
          {level === 'full' &&
            SPARKLES.map((s, i) => (
              <Sparkle
                key={i}
                aria-hidden
                size={i % 2 ? 14 : 18}
                fill="currentColor"
                className="vfx-twinkle absolute text-(--fx-pink)"
                style={{ left: s.left, top: s.top, animationDelay: `${s.delay}ms` }}
              />
            ))}
          {banner.kind === 'clear' ? (
            <div className="tile tile-lime shadow-float relative flex items-center gap-3 py-3 pr-6 pl-3">
              <Robot size={44} mood="happy" />
              <div>
                <p className="display text-xl">Daily Clear</p>
                <p className="text-on-tile-muted text-sm">Every quest for today is done.</p>
              </div>
            </div>
          ) : (
            <div className="tile tile-yellow shadow-float relative flex items-center gap-3 py-3 pr-6 pl-3">
              <span className="bg-bg text-warning-text grid size-11 place-items-center rounded-full">
                <Flame aria-hidden size={22} fill="currentColor" />
              </span>
              <div>
                <p className="display text-xl tabular-nums">{banner.days}-day streak</p>
                <p className="text-on-tile-muted text-sm">You keep showing up.</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
