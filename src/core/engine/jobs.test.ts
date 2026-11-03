import type { JobApplication, JobStage } from '@/core/db/types';
import { dropStageOf, followUpsDue, jobStats } from './jobs';

type Job = Parameters<typeof jobStats>[0][number];
let n = 0;
function job(
  stages: JobStage[],
  applied_at: string | null,
  extra: Partial<JobApplication> = {},
): Job {
  n += 1;
  return {
    id: `j${n}`,
    stage: stages.at(-1) ?? 'saved',
    stage_history: stages.map((stage) => ({ stage, at: '2026-11-01T00:00:00.000Z' })),
    applied_at,
    follow_up_at: null,
    deleted_at: null,
    ...extra,
  };
}

describe('jobStats', () => {
  const jobs = [
    job(['saved'], null),
    job(['applied'], '2026-11-02'),
    job(['applied', 'ghosted'], '2026-10-20'),
    job(['applied', 'rejected'], '2026-10-27'),
    job(['applied', 'interview', 'rejected'], '2026-10-27'),
    job(['applied', 'assessment', 'interview', 'rejected'], '2026-10-13'),
    job(['applied', 'interview', 'offer'], '2026-10-06'),
    job(['applied'], '2026-11-03', { deleted_at: 'x' }),
  ];
  const s = jobStats(jobs, '2026-11-04', 1);

  it('counts applications, answers (a rejection is an answer), interviews and offers', () => {
    expect(s.applied).toBe(6);
    expect(s.responded).toBe(4);
    expect(s.responseRate).toBeCloseTo(4 / 6);
    expect(s.interviews).toBe(3);
    expect(s.offers).toBe(1);
  });

  it('finds where applications end most', () => {
    expect(s.drops).toEqual({ applied: 2, assessment: 0, interview: 2 });
    expect(s.mostDrop).toBe('applied'); // a tie goes to the earlier stage
    expect(dropStageOf(job(['applied', 'assessment', 'rejected'], '2026-11-01'))).toBe(
      'assessment',
    );
    expect(dropStageOf(job(['saved', 'ghosted'], null))).toBeNull();
  });

  it('applications per week, the last 8 weeks, oldest first', () => {
    expect(s.perWeek).toHaveLength(8);
    expect(s.perWeek.at(-1)).toEqual({ day: '2026-11-02', value: 1 });
    expect(s.perWeek.at(-2)).toEqual({ day: '2026-10-26', value: 2 });
    expect(s.perWeek.reduce((t, w) => t + w.value, 0)).toBe(6);
  });

  it('no applications → no rate, no drop stage', () => {
    const empty = jobStats([], '2026-11-04', 1);
    expect(empty.responseRate).toBeNull();
    expect(empty.mostDrop).toBeNull();
  });
});

describe('followUpsDue', () => {
  it('lists open applications whose follow-up day has come, oldest first', () => {
    const due = followUpsDue(
      [
        job(['applied'], '2026-10-20', { follow_up_at: '2026-10-27' }),
        job(['applied'], '2026-10-29', { follow_up_at: '2026-11-05' }),
        job(['applied', 'rejected'], '2026-10-20', { follow_up_at: '2026-10-27' }),
        job(['interview'], '2026-10-10', { follow_up_at: '2026-10-25' }),
      ],
      '2026-11-04',
    );
    expect(due.map((j) => j.follow_up_at)).toEqual(['2026-10-25', '2026-10-27']);
  });
});
