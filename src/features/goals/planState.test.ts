import type { MainQuest, Milestone, PlanProposal } from '@/core/db/types';
import { needsPlan, planState } from './planState';

/** UX-4: one definition of where a main quest stands, shared by Goals and Today. */
const q = (over: Partial<MainQuest> = {}) => ({ id: 'q1', status: 'active', ...over }) as MainQuest;
const m = (over: Partial<Milestone>) =>
  ({
    id: 'm',
    main_quest_id: 'q1',
    status: 'upcoming',
    order: 0,
    title: 'M',
    ...over,
  }) as Milestone;
const proposal = { goal_id: 'q1', status: 'pending' } as PlanProposal;

describe('planState', () => {
  it('active with no milestones and no plan waiting → unplanned (and needs a plan)', () => {
    expect(planState(q(), [], []).kind).toBe('unplanned');
    expect(needsPlan(q(), [], [])).toBe(true);
  });

  it('archived milestones do not count as a plan', () => {
    expect(planState(q(), [m({ status: 'archived' })], []).kind).toBe('unplanned');
  });

  it('a plan waiting for approval is not "unplanned"', () => {
    expect(planState(q(), [], [proposal]).kind).toBe('waiting');
    expect(needsPlan(q(), [], [proposal])).toBe(false);
  });

  it('the next milestone is the first active one by order', () => {
    const s = planState(
      q(),
      [
        m({ id: 'a', title: 'Later', status: 'active', order: 2 }),
        m({ id: 'b', title: 'First', status: 'active', order: 1 }),
        m({ id: 'c', title: 'Done', status: 'done', order: 0 }),
      ],
      [],
    );
    expect(s.kind === 'next' && s.milestone.title).toBe('First');
  });

  it('milestones but none active → planned; done / paused quests → done / inactive', () => {
    expect(planState(q(), [m({ status: 'upcoming' })], []).kind).toBe('planned');
    expect(planState(q({ status: 'done' }), [], []).kind).toBe('done');
    expect(planState(q({ status: 'paused' }), [], []).kind).toBe('inactive');
    expect(needsPlan(q({ status: 'paused' }), [], [])).toBe(false);
  });

  it("other goals' milestones and plans are ignored", () => {
    expect(
      planState(q(), [m({ main_quest_id: 'other' })], [{ ...proposal, goal_id: 'other' }]).kind,
    ).toBe('unplanned');
  });
});
