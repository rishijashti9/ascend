/** The "+25 XP" that floats up from a completed quest. Announced politely to screen readers. */
export function XpFloat({ float }: { float: { key: number; xp: number } | null }) {
  return (
    <span aria-live="polite" className="pointer-events-none absolute top-3 right-4">
      {float && (
        <span
          key={float.key}
          className="animate-xp-float display text-accent-text block text-lg tabular-nums"
        >
          +{float.xp} XP
        </span>
      )}
    </span>
  );
}
