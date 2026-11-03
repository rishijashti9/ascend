import { classifyScope } from './scope';

describe('Career and Health only (SPEC 6.7 B–C)', () => {
  it.each([
    ['How do I start learning ROS 2?', 'career'],
    ['Which universities in Germany have good robotics masters?', 'career'],
    ['What GRE score do I need?', 'career'],
    ['I keep procrastinating on my study blocks', 'career'],
    ['How much protein should a vegetarian eat?', 'health'],
    ['How can I sleep better before an exam?', 'health'],
    ['I feel burned out and tired all the time', 'health'],
  ])('“%s” is %s', (q, scope) => {
    expect(classifyScope(q).scope).toBe(scope);
  });

  it.each([
    'Who won the cricket match yesterday?',
    'Write me a poem about the sea',
    'What is the capital of France?',
    'Tell me a joke',
  ])('declines “%s”', (q) => {
    expect(classifyScope(q).scope).toBe('off_topic');
  });

  it('flags medical, crisis and extreme wording', () => {
    expect(classifyScope('My knee pain gets worse after running').medical).toBe(true);
    expect(classifyScope('Which medicine helps me sleep?').medical).toBe(true);
    expect(classifyScope('I want to die').crisis).toBe(true);
    expect(classifyScope('I want to die').scope).toBe('health');
    expect(classifyScope('How do I lose 5 kg in a week?').extreme).toBe(true);
    expect(classifyScope('Can I study more if I sleep less?').extreme).toBe(true);
    expect(classifyScope('How do I get better at C++?').medical).toBe(false);
  });
});
