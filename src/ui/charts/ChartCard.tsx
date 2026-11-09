import { useState, type ReactNode } from 'react';

export interface TableRow {
  label: string;
  value: string;
}

/**
 * A chart in a card: a title that names the series (one series → no legend box), and a
 * "Table" toggle with the same numbers — tooltips enhance, they never gate (dataviz skill).
 */
export function ChartCard({
  title,
  subtitle,
  rows,
  children,
}: {
  title: string;
  subtitle?: string;
  rows: TableRow[];
  children: ReactNode;
}) {
  const [table, setTable] = useState(false);
  return (
    <section aria-label={title} className="panel flex flex-col gap-2 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-medium">{title}</h3>
          {subtitle && <p className="text-muted text-xs">{subtitle}</p>}
        </div>
        <button
          type="button"
          aria-pressed={table}
          onClick={() => setTable(!table)}
          className="text-accent-text min-h-11 shrink-0 px-2 text-sm"
        >
          {table ? 'Chart' : 'Table'}
        </button>
      </div>
      {table ? (
        <div className="max-h-72 overflow-y-auto">
          <table className="w-full text-sm">
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-border border-t first:border-t-0">
                  <td className="text-muted py-1">{r.label}</td>
                  <td className="py-1 text-right tabular-nums">{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </section>
  );
}

/** The hover/focus readout: value first (strong), then what and when. */
export function Tooltip({
  x,
  width,
  value,
  label,
}: {
  x: number;
  /** Chart width, so the readout never runs off either edge. */
  width: number;
  value: string;
  label: string;
}) {
  const edge = 70;
  const left = Math.min(Math.max(x, edge), width - edge);
  return (
    <div
      role="status"
      className="border-border bg-surface shadow-overlay pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-md border px-2 py-1 text-xs whitespace-nowrap"
      style={{ left }}
    >
      <span className="text-text font-semibold tabular-nums">{value}</span>{' '}
      <span className="text-muted">{label}</span>
    </div>
  );
}
