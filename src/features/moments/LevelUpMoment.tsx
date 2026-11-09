import { ArrowUpRight } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useEffectsLevel } from '@/app/effects';
import { playFeedback } from '@/app/feedback';
import { dismissMoment, useMoments } from '@/core/state/moments';
import { useProgress } from '@/core/state/progress';
import { Robot } from '@/ui/Robot';
import { MomentArt } from './MomentArt';
import { momentRewards } from './rewards';

/** Reward-grid colours, in order (ELEVATE: green, orange, pink, blue — black text). */
const GRID = ['var(--fx-green)', 'var(--fx-orange)', 'var(--fx-pink)', 'var(--fx-blue)'];
const STAR = 'M12 0l2.6 9.4L24 12l-9.4 2.6L12 24l-2.6-9.4L0 12l9.4-2.6z';

/**
 * The level-up / rank-up moment (SPEC 8, ELEVATE in Phase 12): full screen — "You've reached
 * Level N", a short grey line, the morphing-shapes art, a 2×2 grid of real rewards and a white
 * CONTINUE pill. Rank-up is bigger (larger heading, more shapes and sparkles). Skippable with
 * one tap on Continue or Esc; with Effects off or "reduce motion" it simply appears, still.
 */
export function LevelUpMoment() {
  const moment = useMoments((s) => s.queue[0]);
  const progress = useProgress((s) => s.progress);
  const level = useEffectsLevel();
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!moment) return;
    button.current?.focus();
    playFeedback(moment.rank ? 'rankup' : 'levelup');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismissMoment();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moment]);

  if (!moment) return null;
  const rank = moment.rank !== null;
  const heading = moment.rank
    ? `Rank ${moment.rank}`
    : moment.level
      ? `Level ${moment.level}`
      : 'Stat up';
  const kicker = rank ? 'Rank up' : moment.level ? 'Level up' : 'Growing';
  const line = rank
    ? 'A rare step. Ranks never go down — this one is yours for good.'
    : 'Every quest you finished built this. The System has recorded your growth.';
  const rewards = momentRewards(moment, progress);
  const rise = level === 'off' ? '' : 'vfx-rise';

  return (
    <div className="bg-bg fixed inset-0 z-50 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="moment-heading"
        className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.75rem,env(safe-area-inset-bottom))]"
      >
        <p className="text-accent-text flex items-center gap-2 text-xs font-semibold tracking-[0.2em] uppercase">
          <Robot size={28} mood="happy" />
          {kicker}
        </p>
        <h2 className={`mt-5 text-3xl leading-tight font-normal ${rise}`}>
          You’ve reached
          <span
            id="moment-heading"
            className={`display block tabular-nums ${rank ? 'text-6xl' : 'text-[2.5rem]'}`}
          >
            {heading}
          </span>
        </h2>
        <p
          className={`text-muted mt-3 max-w-xs text-sm ${rise}`}
          style={{ animationDelay: '150ms' }}
        >
          {line}
        </p>

        <div className="mt-4">
          <MomentArt rank={rank} level={level} />
        </div>

        {rewards.length > 0 && (
          <ul
            className={`mt-4 grid grid-cols-2 overflow-hidden rounded-(--r-lg) ${rise}`}
            style={{ animationDelay: '500ms' }}
          >
            {rewards.map((r, i) => (
              <li
                key={r.key}
                className="text-(--on-fx) relative flex min-h-24 flex-col justify-end gap-0.5 p-3.5"
                style={{ background: GRID[i % GRID.length] }}
              >
                <svg aria-hidden viewBox="0 0 24 24" className="absolute top-3.5 left-3.5 size-4">
                  <path d={STAR} fill="currentColor" />
                </svg>
                <span className="display text-base">{r.title}</span>
                <span className="text-xs font-medium">{r.line}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-auto pt-6">
          <button
            ref={button}
            type="button"
            onClick={dismissMoment}
            className="bg-tile-white text-on-tile-white flex min-h-14 w-full items-center justify-between rounded-full py-2 pr-2 pl-6 transition-transform duration-(--dur-fast) active:scale-[0.98]"
          >
            <span className="display text-base uppercase">Continue</span>
            <span
              aria-hidden
              className="bg-bg text-text grid size-11 place-items-center rounded-full"
            >
              <ArrowUpRight size={18} strokeWidth={2.6} />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
