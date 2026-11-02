import { Brain, Dumbbell, Zap, type LucideIcon } from 'lucide-react';
import type { Stat } from '@/core/db/types';

/** Each stat has a colour, an icon and a label — never colour alone (SPEC 8). */
export const STAT_META: Record<
  Stat,
  { label: string; icon: LucideIcon; text: string; fill: string }
> = {
  STR: { label: 'Strength', icon: Dumbbell, text: 'text-str-text', fill: 'bg-str' },
  INT: { label: 'Intellect', icon: Brain, text: 'text-int-text', fill: 'bg-int' },
  WIL: { label: 'Willpower', icon: Zap, text: 'text-wil-text', fill: 'bg-wil' },
};
