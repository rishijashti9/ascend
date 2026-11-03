import { FIELDS } from '@/data/compass/schema';
import { careerSkillGraph, careersIn, learningOrder, matchSkillTree } from './careers';
import { careerById, pack } from './pack';

describe('career set (SPEC 6.7 B, DECISIONS: broad + deep)', () => {
  it('is broad: 60–100 careers across every field, each with a source', () => {
    const careers = pack().careers;
    expect(careers.length).toBeGreaterThanOrEqual(60);
    expect(careers.length).toBeLessThanOrEqual(100);
    for (const f of FIELDS) expect(careers.some((c) => c.field === f)).toBe(true);
    for (const c of careers) expect(c.sources.length).toBeGreaterThan(0);
  });

  it('is deep for the robotics / AI / games path', () => {
    for (const id of [
      'robotics-engineer',
      'ml-engineer',
      'computer-vision-engineer',
      'controls-engineer',
      'embedded-engineer',
      'simulation-engineer',
      'game-programmer',
      'technical-artist',
    ]) {
      const c = careerById(id);
      expect(c?.deep, id).toBe(true);
      expect(c?.skills.length, id).toBeGreaterThanOrEqual(8);
    }
    expect(careersIn('engineering')[0]?.deep).toBe(true);
  });
});

describe('career → skill graph', () => {
  it('orders every prerequisite before the skills that need it', () => {
    const robotics = careerById('robotics-engineer');
    if (!robotics) throw new Error('missing career');
    const graph = careerSkillGraph(robotics);
    const pos = new Map(graph.map((s, i) => [s.id, i]));
    for (const s of graph)
      for (const pre of s.prereqs)
        expect(pos.get(pre), `${pre} before ${s.id}`).toBeLessThan(pos.get(s.id) ?? -1);
    expect(graph.map((s) => s.id)).toContain('physics'); // pulled in as a prerequisite
  });

  it('learningOrder ignores unknown ids and never repeats a skill', () => {
    const order = learningOrder(['ros2', 'nope', 'ros2']);
    expect(new Set(order.map((s) => s.id)).size).toBe(order.length);
    expect(order.at(-1)?.id).toBe('ros2');
  });

  it('maps onto the skill tree by name and alias, with its level', () => {
    const graph = learningOrder(['ros2', 'kinematics-dynamics']);
    const tree = [
      { id: 'skill:robotics:ros-2', name: 'ROS 2', status: 'active' as const },
      { id: 'skill:robotics:kin', name: 'Kinematics & dynamics', status: 'active' as const },
      { id: 'x', name: 'C++', status: 'archived' as const },
    ];
    const m = matchSkillTree(graph, tree, (id) => (id === 'skill:robotics:ros-2' ? 2 : 1));
    expect(m.find((x) => x.skill.id === 'ros2')).toMatchObject({
      level: 2,
      tree: { name: 'ROS 2' },
    });
    expect(m.find((x) => x.skill.id === 'kinematics-dynamics')?.level).toBe(1);
    expect(m.find((x) => x.skill.id === 'cpp')?.tree).toBeNull(); // archived doesn't count
  });
});
