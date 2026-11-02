import { useEffect, useRef, useState } from 'react';
import type { DaySummary } from '@/core/engine/progressState';
import { heatmapYear, type HeatCell, type HeatLevel } from '@/core/engine/profile';
import type { DayString } from '@/core/db/types';
import type { Weekday } from '@/core/time';
import { formatDay } from '@/features/goals/format';
import { ChartCard } from '@/ui/charts/ChartCard';

const CELL = 11;
const GAP = 2;
const STEP = CELL + GAP;
const LEFT = 28;
const TOP = 16;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** One hue, light → dark (sequential): empty, active, Daily Clear. */
const FILL: Record<HeatLevel, string> = {
  0: 'var(--surface-2)',
  1: 'color-mix(in srgb, var(--accent-text) 40%, var(--surface))',
  2: 'var(--accent-text)',
};
const LEVEL_NAME: Record<HeatLevel, string> = { 0: 'Not active', 1: 'Active', 2: 'Daily Clear' };

function describe(cell: HeatCell): string {
  if (cell.outside) return `${formatDay(cell.day)} — not played`;
  return `${formatDay(cell.day)} — ${LEVEL_NAME[cell.level]}${cell.xp ? ` · ${cell.xp} XP` : ''}`;
}

/**
 * GitHub-style calendar of active days (SPEC 7.8), one year at a time with a year picker
 * back to the first year of play. Hover or arrow keys show a day's readout; Table lists
 * each month's active days and Daily Clears.
 */
export function Heatmap({
  perDay,
  today,
  startDay,
  weekStartsOn,
}: {
  perDay: Record<DayString, DaySummary>;
  today: DayString;
  startDay: DayString;
  weekStartsOn: Weekday;
}) {
  const thisYear = Number(today.slice(0, 4));
  const firstYear = Math.min(Number(startDay.slice(0, 4)), thisYear);
  const [year, setYear] = useState(thisYear);
  const [active, setActive] = useState<HeatCell | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const columns = heatmapYear(perDay, year, weekStartsOn, today, startDay);
  const cells = columns.flat().filter((c): c is HeatCell => c !== null);
  const years = Array.from({ length: thisYear - firstYear + 1 }, (_, i) => thisYear - i);

  // Start scrolled to today (the right end on a phone).
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = year === thisYear ? el.scrollWidth : 0;
  }, [year, thisYear]);

  const months = Array.from({ length: 12 }, (_, m) => {
    const prefix = `${year}-${String(m + 1).padStart(2, '0')}`;
    const inMonth = cells.filter((c) => c.day.startsWith(prefix) && !c.outside);
    return {
      prefix,
      col: columns.findIndex((col) => col.some((c) => c?.day === `${prefix}-01`)),
      active: inMonth.filter((c) => c.level > 0).length,
      clears: inMonth.filter((c) => c.level === 2).length,
      label: new Date(`${prefix}-15T12:00:00Z`).toLocaleDateString(undefined, {
        month: 'short',
        timeZone: 'UTC',
      }),
    };
  });
  const width = LEFT + columns.length * STEP;
  const height = TOP + 7 * STEP;
  const playable = cells.filter((c) => !c.outside);

  function move(e: React.KeyboardEvent) {
    const delta = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 }[e.key];
    if (delta === undefined || playable.length === 0) return;
    e.preventDefault();
    const index = active ? playable.findIndex((c) => c.day === active.day) : -1;
    const next = index < 0 ? playable.length - 1 : index + delta;
    setActive(playable[Math.max(0, Math.min(playable.length - 1, next))] ?? null);
  }

  const totalActive = playable.filter((c) => c.level > 0).length;

  return (
    <ChartCard
      title="Active days"
      subtitle={`${totalActive} active day${totalActive === 1 ? '' : 's'} in ${year}`}
      rows={months
        .filter((m) => m.prefix <= today.slice(0, 7))
        .map((m) => ({
          label: `${m.label} ${year}`,
          value: `${m.active} active · ${m.clears} Daily Clear${m.clears === 1 ? '' : 's'}`,
        }))}
    >
      {years.length > 1 && (
        <div role="group" aria-label="Year" className="flex flex-wrap gap-1">
          {years.map((y) => (
            <button
              key={y}
              type="button"
              aria-pressed={y === year}
              onClick={() => {
                setYear(y);
                setActive(null);
              }}
              className={`min-h-11 rounded-md px-3 text-sm ${
                y === year ? 'bg-surface-2 font-semibold' : 'text-muted'
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      )}
      <div ref={scroller} className="overflow-x-auto">
        <svg
          width={width}
          height={height}
          role="img"
          tabIndex={0}
          aria-label={`Activity calendar for ${year}. Use the arrow keys to read a day.`}
          onKeyDown={move}
          onMouseLeave={() => setActive(null)}
          onBlur={() => setActive(null)}
          className="focus-visible:outline-accent rounded-sm"
        >
          {months.map(
            (m) =>
              m.col >= 0 && (
                <text
                  key={m.prefix}
                  x={LEFT + m.col * STEP}
                  y={10}
                  fontSize={10}
                  fill="var(--muted)"
                >
                  {m.label}
                </text>
              ),
          )}
          {[1, 3, 5].map((row) => (
            <text key={row} x={0} y={TOP + row * STEP + CELL - 2} fontSize={10} fill="var(--muted)">
              {WEEKDAYS[(weekStartsOn + row) % 7]}
            </text>
          ))}
          {columns.map((col, x) =>
            col.map(
              (cell, y) =>
                cell && (
                  <rect
                    key={cell.day}
                    x={LEFT + x * STEP}
                    y={TOP + y * STEP}
                    width={CELL}
                    height={CELL}
                    rx={2}
                    fill={cell.outside ? 'transparent' : FILL[cell.level]}
                    stroke={
                      active?.day === cell.day
                        ? 'var(--text)'
                        : cell.outside
                          ? 'var(--border)'
                          : 'none'
                    }
                    strokeWidth={active?.day === cell.day ? 1.5 : 1}
                    onMouseEnter={() => setActive(cell)}
                  />
                ),
            ),
          )}
        </svg>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <p role="status" className="min-h-4 font-medium">
          {active ? describe(active) : ''}
        </p>
        <div className="text-muted flex items-center gap-3">
          {([0, 1, 2] as const).map((l) => (
            <span key={l} className="flex items-center gap-1">
              <span className="inline-block size-3 rounded-[2px]" style={{ background: FILL[l] }} />
              {LEVEL_NAME[l]}
            </span>
          ))}
        </div>
      </div>
    </ChartCard>
  );
}
