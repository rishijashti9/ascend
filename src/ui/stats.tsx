import { Brain, Dumbbell, Flame, type LucideIcon } from 'lucide-react';
import type { Stat } from '@/core/db/types';

/** Each stat has a colour, an icon and a label — never colour alone (SPEC 8). */
const STAT_META: Record<Stat, { label: string; icon: LucideIcon; text: string }> = {
  STR: { label: 'Strength', icon: Dumbbell, text: 'text-str-text' },
  INT: { label: 'Intellect', icon: Brain, text: 'text-int-text' },
  WIL: { label: 'Willpower', icon: Flame, text: 'text-wil-text' },
};

export function StatChip({ stat }: { stat: Stat }) {
  const { icon: Icon, text, label } = STAT_META[stat];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${text}`} title={label}>
      <Icon aria-hidden size={14} />
      {stat}
    </span>
  );
}
