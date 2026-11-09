import { Burst, type BurstTone } from './vfx/Burst';

/**
 * The "+25 XP" that floats up from a completed quest, with the theme's burst behind it
 * (Phase 12 VFX; `upgrade` for a min→full top-up). Announced politely to screen readers.
 */
export function XpFloat({
  float,
  tone = 'complete',
}: {
  float: { key: number; xp: number } | null;
  tone?: BurstTone;
}) {
  return (
    <span aria-live="polite" className="pointer-events-none absolute top-3 right-4">
      {float && (
        <>
          <Burst fireKey={float.key} tone={tone} />
          <span
            key={float.key}
            className="animate-xp-float display text-accent-text relative block text-lg tabular-nums"
          >
            +{float.xp} XP
          </span>
        </>
      )}
    </span>
  );
}
