import { useState } from 'react';
import type { DayString } from '@/core/db/types';
import { Tooltip } from './ChartCard';
import { axisNumber, niceTicks, shortDay } from './scale';
import { useWidth } from './useWidth';

const H = 160;
const PAD = { top: 20, right: 8, bottom: 22, left: 40 };
const R = 4;

/** A column with a 4px rounded data-end, square at the baseline. */
function column(x: number, w: number, top: number, base: number): string {
  const h = base - top;
  if (h <= 0) return '';
  const r = Math.min(R, h, w / 2);
  return `M${x},${base}V${top + r}Q${x},${top} ${x + r},${top}H${x + w - r}Q${x + w},${top} ${x + w},${top + r}V${base}Z`;
}

/**
 * One value per day (steps, sleep, focus minutes): thin columns from one baseline with a
 * 2px surface gap, an optional labelled target line, and a per-bar hover/focus readout.
 * Days without a value are left empty (not drawn as zero).
 */
export function DailyBars({
  bars,
  unit,
  target,
  label,
  format = (v: number) => v.toLocaleString(),
}: {
  bars: { day: DayString; value: number | null }[];
  unit: string;
  target?: { value: number; label: string } | null;
  label: string;
  format?: (v: number) => string;
}) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const values = bars.flatMap((b) => (b.value === null ? [] : [b.value]));
  if (values.length === 0) return null;

  const ticks = niceTicks(0, Math.max(...values, target?.value ?? 0));
  const hi = ticks.at(-1) ?? 1;
  const plotW = width - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const base = PAD.top + plotH;
  const band = plotW / bars.length;
  const w = Math.max(2, Math.min(24, band - 2)); // ≤ 24px, 2px surface gap
  const xOf = (i: number) => PAD.left + i * band + (band - w) / 2;
  const y = (v: number) => PAD.top + (1 - v / hi) * plotH;
  const hover = active === null ? null : bars[active];

  return (
    <div ref={ref} className="relative">
      {hover && hover.value !== null && active !== null && (
        <Tooltip
          width={width}
          x={xOf(active) + w / 2}
          value={`${format(hover.value)} ${unit}`}
          label={shortDay(hover.day)}
        />
      )}
      <svg
        width={width}
        height={H}
        role="img"
        aria-label={`${label}: ${values.length} days with data`}
        className="block overflow-visible"
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={PAD.left + plotW}
              y1={y(t)}
              y2={y(t)}
              stroke="var(--border)"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 6}
              y={y(t)}
              dy="0.32em"
              textAnchor="end"
              fontSize={11}
              fill="var(--muted)"
              className="tabular-nums"
            >
              {axisNumber(t)}
            </text>
          </g>
        ))}
        {bars.map((b, i) => (
          <g key={b.day}>
            {b.value !== null && (
              <path
                d={column(xOf(i), w, y(b.value), base)}
                fill="var(--accent-text)"
                opacity={active === null || active === i ? 1 : 0.55}
              />
            )}
            {/* The hit target is the whole day's band, bigger than the bar. */}
            <rect
              x={PAD.left + i * band}
              y={PAD.top}
              width={band}
              height={plotH}
              fill="transparent"
              tabIndex={b.value === null ? -1 : 0}
              aria-label={
                b.value === null ? undefined : `${shortDay(b.day)}: ${format(b.value)} ${unit}`
              }
              onPointerEnter={() => setActive(i)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
            />
          </g>
        ))}
        {target && (
          <g pointerEvents="none">
            <line
              x1={PAD.left}
              x2={PAD.left + plotW}
              y1={y(target.value)}
              y2={y(target.value)}
              stroke="var(--muted)"
              strokeWidth={1}
            />
            <text
              x={PAD.left + 4}
              y={y(target.value) - 4}
              stroke="var(--surface)"
              strokeWidth={3}
              paintOrder="stroke"
              fontSize={11}
              fill="var(--muted)"
            >
              {target.label}
            </text>
          </g>
        )}
        <text x={PAD.left} y={H - 6} fontSize={11} fill="var(--muted)">
          {shortDay(bars[0]?.day ?? '')}
        </text>
        <text x={PAD.left + plotW} y={H - 6} fontSize={11} fill="var(--muted)" textAnchor="end">
          {shortDay(bars.at(-1)?.day ?? '')}
        </text>
      </svg>
    </div>
  );
}
