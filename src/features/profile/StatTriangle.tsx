import type { Stat } from '@/core/db/types';
import { STATS } from '@/core/db/types';
import { ChartCard } from '@/ui/charts/ChartCard';
import { STAT_META } from '@/ui/statMeta';

const SIZE = 240;
const C = SIZE / 2;
const R = 78;
const ANGLE: Record<Stat, number> = { STR: -90, INT: 30, WIL: 150 };
const point = (stat: Stat, r: number) => {
  const a = (ANGLE[stat] * Math.PI) / 180;
  return { x: C + r * Math.cos(a), y: C + r * Math.sin(a) };
};
const polygon = (r: (s: Stat) => number) =>
  STATS.map((s) => {
    const p = point(s, r(s));
    return `${p.x},${p.y}`;
  }).join(' ');

/**
 * The three stats as a triangle (SPEC 4.2): each corner is a stat's level, scaled to the
 * highest one, so imbalance shows as a lopsided shape. Every corner is labelled with its
 * value — the shape is never the only way to read it.
 */
export function StatTriangle({ levels }: { levels: Record<Stat, number> }) {
  const max = Math.max(...STATS.map((s) => levels[s]), 1);
  return (
    <ChartCard
      title="Stats"
      subtitle="Each corner is a stat's level; a balanced triangle means balanced growth."
      rows={STATS.map((s) => ({ label: STAT_META[s].label, value: `Level ${levels[s]}` }))}
    >
      <svg
        viewBox={`0 6 ${SIZE} 184`}
        className="mx-auto w-full max-w-64"
        role="img"
        aria-label={STATS.map((s) => `${STAT_META[s].label} level ${levels[s]}`).join(', ')}
      >
        {[1 / 3, 2 / 3, 1].map((f) => (
          <polygon key={f} points={polygon(() => R * f)} fill="none" stroke="var(--border)" />
        ))}
        {STATS.map((s) => {
          const end = point(s, R);
          return <line key={s} x1={C} y1={C} x2={end.x} y2={end.y} stroke="var(--border)" />;
        })}
        <polygon
          points={polygon((s) => (R * levels[s]) / max)}
          fill="var(--accent-text)"
          fillOpacity={0.1}
          stroke="var(--accent-text)"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {STATS.map((s) => {
          const p = point(s, (R * levels[s]) / max);
          return (
            <circle
              key={s}
              cx={p.x}
              cy={p.y}
              r={4.5}
              fill={`var(--${s.toLowerCase()})`}
              stroke="var(--surface)"
              strokeWidth={2}
            />
          );
        })}
        {STATS.map((s) => {
          const p = point(s, R + 22);
          return (
            <text
              key={s}
              x={p.x}
              y={p.y + 4}
              textAnchor="middle"
              fontSize={13}
              fill="var(--text)"
              fontWeight={600}
            >
              {s} {levels[s]}
            </text>
          );
        })}
      </svg>
    </ChartCard>
  );
}
