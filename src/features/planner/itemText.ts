import type { ProposalItem } from '@/core/planner';
import { formatDay } from '@/features/goals/format';

/** Plain-words label for one planned change. */
export function itemLabel(item: ProposalItem): string {
  switch (item.kind) {
    case 'milestone.create':
      return `Milestone: ${item.data.title}${item.data.target_date ? ` · by ${formatDay(item.data.target_date)}` : ''}`;
    case 'quest.create':
      return `This week: ${item.data.title}`;
    case 'habit.create':
      return `Daily quest: ${item.data.title}`;
    case 'habit.update':
      if (item.changes.target_value !== undefined) {
        return `“${item.title}”: ${item.changes.target_value} min a day`;
      }
      return `Link “${item.title}” to this goal`;
    case 'habit.pause':
      return `Pause “${item.title}”`;
    case 'habit.archive':
      return `Archive “${item.title}”`;
    case 'habit.restore':
      return `Bring back “${item.title}”`;
    case 'quest.archive':
      return `Archive this week’s “${item.title}”`;
    case 'milestone.setStatus':
      return item.status === 'active' ? `Start “${item.title}”` : `${item.status}: “${item.title}”`;
    case 'mainQuest.setStatus':
      return `${item.status === 'active' ? 'Resume' : item.status === 'paused' ? 'Pause' : item.status === 'done' ? 'Finish' : 'Archive'} “${item.title}”`;
  }
}

export type Group = 'added' | 'changed' | 'removed';

/** SPEC 6.3 step 4: what gets added, what changes, what gets removed or paused. */
export function groupOf(item: ProposalItem): Group {
  switch (item.kind) {
    case 'milestone.create':
    case 'quest.create':
    case 'habit.create':
    case 'habit.restore':
      return 'added';
    case 'habit.pause':
    case 'habit.archive':
    case 'quest.archive':
      return 'removed';
    case 'mainQuest.setStatus':
      return item.status === 'active' ? 'changed' : 'removed';
    default:
      return 'changed';
  }
}

export const GROUP_TITLE: Record<Group, string> = {
  added: 'Added',
  changed: 'Changed',
  removed: 'Paused or removed',
};
