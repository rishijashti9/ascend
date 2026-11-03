import { careerSkillGraph } from './careers';
import { careerById } from './pack';
import { careerGap, careerPlanItems, DEFAULT_WEEKLY_HOURS } from './gap';

const robotics = careerById('robotics-engineer');
if (!robotics) throw new Error('missing career');
const tree = [
  { id: 's-cpp', name: 'C++', status: 'active' as const },
  { id: 's-ros', name: 'ROS 2', status: 'active' as const },
];
const levels: Record<string, number> = { 's-cpp': 3, 's-ros': 1 };
const levelOf = (id: string) => levels[id] ?? 0;
const TODAY = '2026-11-02';

describe('career gap analysis (SPEC 6.7 B)', () => {
  it('lists what is missing in learning order, skipping what the tree already covers', () => {
    const gap = careerGap(robotics, tree, levelOf, null, TODAY);
    const cpp = gap.items.find((i) => i.skill.id === 'cpp');
    const ros = gap.items.find((i) => i.skill.id === 'ros2');
    expect(cpp).toMatchObject({ have: 3, need: 3, hoursLeft: 0 });
    expect(ros).toMatchObject({ have: 1, need: 3, hoursLeft: 100 }); // 150 h × 2/3
    expect(gap.done).toBeGreaterThan(0);
    expect(gap.readiness.weeklyHours).toBe(DEFAULT_WEEKLY_HOURS);
    expect(gap.readiness.confidence).toBe('early');
    expect(gap.readiness.why).toMatch(/your real pace isn’t known yet/);
  });

  it('forecasts readiness from the real pace when it is known', () => {
    const capacity = {
      doneMinutes: 1200,
      plannedMinutes: 1500,
      ratio: 0.8,
      weeks: 6,
      confidence: 'confident' as const,
    };
    const gap = careerGap(robotics, tree, levelOf, capacity, TODAY);
    expect(gap.readiness.weeklyHours).toBe(14); // 70% of 20 h
    expect(gap.readiness.weeks).toBe(Math.ceil(gap.hoursLeft / 14));
    expect(gap.readiness.why).toMatch(/At your real pace \(about 14 focused hours a week\)/);
  });

  it('becomes planner milestones (dated, first active) and this week’s quests from the roadmap', () => {
    const gap = careerGap(robotics, tree, levelOf, null, TODAY);
    const items = careerPlanItems(gap, 'mq1', 'INT', TODAY, TODAY);
    const ms = items.filter((i) => i.kind === 'milestone.create');
    expect(ms.length).toBeGreaterThan(0);
    expect(ms.length).toBeLessThanOrEqual(6);
    expect(ms[0]?.kind === 'milestone.create' && ms[0].data.status).toBe('active');
    expect(
      ms.slice(1).every((m) => m.kind === 'milestone.create' && m.data.status === 'upcoming'),
    ).toBe(true);
    const weekly = items.filter((i) => i.kind === 'quest.create');
    expect(weekly.length).toBeGreaterThan(0);
    expect(
      weekly.every((w) => w.kind === 'quest.create' && w.data.linked_goal_id === 'ref:m1'),
    ).toBe(true);
    expect(ms[0]?.reason).toMatch(/for Robotics engineer — about \d+ h to level \d/);
  });

  it('nothing missing → ready now, no plan items', () => {
    const full = careerSkillGraph(robotics).map((sk) => ({
      id: sk.id,
      name: sk.name,
      status: 'active' as const,
    }));
    const all = careerGap(robotics, full, () => 5, null, TODAY);
    expect(all.hoursLeft).toBe(0);
    expect(careerPlanItems(all, 'mq1', 'INT', TODAY, TODAY)).toEqual([]);
  });
});
