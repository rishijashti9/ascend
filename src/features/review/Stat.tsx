/** One number on a review's stats panel. */
export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-muted text-xs">{label}</span>
      <span className="text-lg font-semibold">{value}</span>
    </div>
  );
}
