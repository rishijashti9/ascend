import type { Stat } from '@/core/db/types';
import { STAT_META } from './statMeta';

export function StatChip({ stat }: { stat: Stat }) {
  const { icon: Icon, text, label } = STAT_META[stat];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${text}`} title={label}>
      <Icon aria-hidden size={14} />
      {stat}
    </span>
  );
}
