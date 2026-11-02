import { useState } from 'react';
import type { DayString } from '@/core/db/types';
import { diffDays } from '@/core/time';
import { Tooltip } from './ChartCard';
import { useWidth } from './useWidth';
import { axisNumber, niceTicks, shortDay } from './scale';

const H = 180;
const PAD = { top: 24, right: 52, bottom: 24, left: 40 };

/**
 * A value over time (weight, waist): 2px line with a 10% wash, an end dot with a surface
 * ring and its value, hairline grid, optional target line (labelled, never color alone).
 * Crosshair: hover or arrow keys snap to the nearest day and show its value.
 */
export function TrendLine({
  points,
  unit,
  target,
  label,
}: {
  points: { day: DayString; value: number }[];
  unit: string;
  target?: { value: number; label: string } | null;
  label: string;
}) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  if (points.length < 2) return null;

  const first = points[0]?.day ?? '';
  const last = points.at(-1)?.day ?? first;
  const span = Math.max(1, diffDays(first, last));
  const values = points.map((p) => p.value).concat(target ? [target.value] : []);
  const ticks = niceTicks(Math.min(...values), Math.max(...values));
  const lo = ticks[0] ?? 0;
  const hi = ticks.at(-1) ?? 1;
  const plotW = width - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (day: DayString) => PAD.left + (diffDays(first, day) / span) * plotW;
  const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo || 1)) * plotH;

  const line = points
    .map((p, i) => `${i ? 'L' : 'M'}${x(p.day).toFixed(1)},${y(p.value).toFixed(1)}`)
    .join('');
  const area = `${line}L${x(last).toFixed(1)},${PAD.top + plotH}L${x(first).toFixed(1)},${PAD.top + plotH}Z`;
  const end = points.at(-1);
  const hover = active === null ? null : points[active];

  const nearest = (clientX: number, rectLeft: number) => {
    const px = clientX - rectLeft;
    let best = 0;
    points.forEach((p, i) => {
      if (Math.abs(x(p.day) - px) < Math.abs(x(points[best]?.day ?? first) - px)) best = i;
    });
    return best;
  };

  return (
    <div ref={ref} className="relative">
      {hover && (
        <Tooltip
          width={width}
          x={x(hover.day)}
          value={`${hover.value} ${unit}`}
          label={shortDay(hover.day)}
        />
      )}
      <svg
        width={width}
        height={H}
        role="img"
        aria-label={`${label}: ${points.length} entries, latest ${end?.value} ${unit}`}
        tabIndex={0}
        className="block overflow-visible outline-none focus-visible:outline-2"
        onPointerMove={(e) =>
          setActive(nearest(e.clientX, e.currentTarget.getBoundingClientRect().left))
        }
        onPointerLeave={() => setActive(null)}
        onBlur={() => setActive(null)}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
          e.preventDefault();
          const cur = active ?? points.length - 1;
          setActive(
            Math.max(0, Math.min(points.length - 1, cur + (e.key === 'ArrowLeft' ? -1 : 1))),
          );
        }}
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
        <text x={PAD.left} y={H - 6} fontSize={11} fill="var(--muted)">
          {shortDay(first)}
        </text>
        <text x={PAD.left + plotW} y={H - 6} fontSize={11} fill="var(--muted)" textAnchor="end">
          {shortDay(last)}
        </text>
        {target && (
          <g>
            <line
              x1={PAD.left}
              x2={PAD.left + plotW}
              y1={y(target.value)}
              y2={y(target.value)}
              stroke="var(--muted)"
              strokeWidth={1}
            />
            <text
              x={PAD.left + plotW + 4}
              y={y(target.value)}
              dy="0.32em"
              fontSize={11}
              fill="var(--muted)"
            >
              {target.label}
            </text>
          </g>
        )}
        <path d={area} fill="var(--accent-text)" opacity={0.1} />
        <path
          d={line}
          fill="none"
          stroke="var(--accent-text)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {hover && (
          <line
            x1={x(hover.day)}
            x2={x(hover.day)}
            y1={PAD.top}
            y2={PAD.top + plotH}
            stroke="var(--muted)"
            strokeWidth={1}
          />
        )}
        {end && (
          <g>
            <circle
              cx={x(end.day)}
              cy={y(end.value)}
              r={5}
              fill="var(--accent-text)"
              stroke="var(--surface)"
              strokeWidth={2}
            />
            {!target || Math.abs(y(target.value) - y(end.value)) > 14 ? (
              <text
                x={x(end.day) + 8}
                y={y(end.value)}
                dy="0.32em"
                fontSize={12}
                fontWeight={600}
                fill="var(--text)"
                className="tabular-nums"
              >
                {end.value}
              </text>
            ) : null}
          </g>
        )}
        {hover && hover !== end && (
          <circle
            cx={x(hover.day)}
            cy={y(hover.value)}
            r={4}
            fill="var(--accent-text)"
            stroke="var(--surface)"
            strokeWidth={2}
          />
        )}
      </svg>
    </div>
  );
}
