import type { CSSProperties } from 'react';
import { useEffectsLevel } from '@/app/effects';
import { particleCount } from './celebrations';

export type BurstTone = 'complete' | 'upgrade' | 'celebrate';

/** Particle colours per tone — theme variables, so every theme recolours its own bursts. */
const COLOURS: Record<BurstTone, string[]> = {
  complete: ['var(--accent)', 'var(--text)'],
  upgrade: ['var(--accent)', 'var(--warning)', 'var(--text)'],
  celebrate: ['var(--accent)', 'var(--fx-violet)', 'var(--fx-blue)', 'var(--fx-pink)'],
};

/**
 * A one-shot burst of particles and a ring from the centre of its (relative) parent — quest
 * complete, min→full upgrade, celebrations (Phase 12 VFX). Transform and opacity only; each new
 * `fireKey` plays it once. Effects Light = fewer particles and no ring; Off (or "reduce motion")
 * = nothing at all. Decorative: the card or banner beside it carries the meaning.
 */
export function Burst({
  fireKey,
  tone = 'complete',
  big = false,
  className = 'inset-0',
}: {
  fireKey: number | null;
  tone?: BurstTone;
  big?: boolean;
  /** Where the burst's centre sits inside the parent (default: its middle). */
  className?: string;
}) {
  const level = useEffectsLevel();
  const n = particleCount(level, big);
  if (fireKey === null || n === 0) return null;
  const colours = COLOURS[tone];
  const reach = big ? 120 : 56;
  return (
    <span
      key={fireKey}
      aria-hidden
      className={`pointer-events-none absolute grid place-items-center overflow-visible ${className}`}
    >
      {level === 'full' && (
        <span
          className="vfx-ring absolute size-12 rounded-full border-2"
          style={{ borderColor: colours[0] }}
        />
      )}
      {level === 'full' && tone === 'upgrade' && (
        <span
          className="vfx-ring vfx-delay absolute size-12 rounded-full border-2"
          style={{ borderColor: colours[1] }}
        />
      )}
      {Array.from({ length: n }, (_, i) => {
        // Even spread with a per-burst twist, and alternating reach, so no two look the same.
        const angle = ((i / n) * 360 + (fireKey % 37)) * (Math.PI / 180);
        const dist = reach * (i % 2 ? 0.65 : 1);
        const style = {
          '--vx': `${Math.round(Math.cos(angle) * dist)}px`,
          '--vy': `${Math.round(Math.sin(angle) * dist)}px`,
          background: colours[i % colours.length],
        } as CSSProperties;
        return (
          <span
            key={i}
            className={`vfx-particle absolute rounded-full ${i % 3 === 0 ? 'size-2.5' : 'size-1.5'}`}
            style={style}
          />
        );
      })}
    </span>
  );
}
