import type { JobStage } from '@/core/db/types';
import type { DropStage } from '@/core/engine/jobs';

export const STAGE_LABEL: Record<JobStage, string> = {
  saved: 'Saved',
  applied: 'Applied',
  assessment: 'Assessment',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
  ghosted: 'Ghosted',
};

/** Columns on the board (desktop) and sections of the list (mobile). */
export const COLUMNS: { key: string; label: string; stages: JobStage[] }[] = [
  { key: 'saved', label: 'Saved', stages: ['saved'] },
  { key: 'applied', label: 'Applied', stages: ['applied'] },
  { key: 'assessment', label: 'Assessment', stages: ['assessment'] },
  { key: 'interview', label: 'Interview', stages: ['interview'] },
  { key: 'offer', label: 'Offer', stages: ['offer'] },
  { key: 'closed', label: 'Closed', stages: ['rejected', 'ghosted'] },
];

/** "Most end after applying" — the stats line about where applications stop. */
export const DROP_TEXT: Record<DropStage, string> = {
  applied: 'Most end without an answer to the application',
  assessment: 'Most end at the assessment',
  interview: 'Most end at the interview',
};
