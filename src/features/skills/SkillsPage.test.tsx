import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '@/core/db/db';
import { clearSubscribers, ensureInstancesForDay, recordAction } from '@/core/pipeline';
import { startAppState } from '@/core/state/app';
import { startHabits } from '@/core/state/habits';
import { startQuests } from '@/core/state/quests';
import { startSkills } from '@/core/state/skills';
import { startToday } from '@/core/state/today';
import { resetClock, setNow, setTimeZoneOverride } from '@/core/time';
import { seedSkillId } from '@/data/skills';
import { habitFieldsOf, STARTER_HABITS } from '@/data/starter';
import { ist } from '@/test/testDb';
import { balanceNote, levelRules } from './format';
import { SkillsPage } from './SkillsPage';

const ROS = seedSkillId('Robotics', 'ROS 2');
const UNREAL = seedSkillId('Game development', 'Unreal Engine');
const DAY = '2026-11-02';

async function habit(key: string, skillIds: string[]) {
  const h = STARTER_HABITS.find((x) => x.key === key);
  if (!h) throw new Error('starter missing');
  const r = await recordAction<{ id: string }>({
    type: 'habit.create',
    payload: { ...habitFieldsOf(h), skill_ids: skillIds },
  });
  return r.value?.id ?? '';
}

beforeEach(async () => {
  await db.delete();
  await db.open();
  setTimeZoneOverride('Asia/Kolkata');
  setNow(ist(2026, 11, 2, 21));
  await recordAction({ type: 'skills.seed', source: 'system', payload: {} });
  const ai = await habit('ai-study', [ROS]);
  const games = await habit('gamedev-study', [UNREAL]);
  await ensureInstancesForDay(db, DAY);
  await recordAction({
    type: 'quest.logProgress',
    payload: { instanceId: `${ai}:${DAY}`, amount: 140 },
  });
  await recordAction({
    type: 'quest.logProgress',
    payload: { instanceId: `${games}:${DAY}`, amount: 60 },
  });
  await startAppState();
  await startToday();
  await startHabits();
  await startQuests();
  await startSkills();
  render(<SkillsPage />);
});
afterEach(() => {
  clearSubscribers();
  resetClock();
});

describe('Skills screen', () => {
  it('shows the tree with levels and this week’s 70/30 balance', async () => {
    expect(await screen.findByRole('region', { name: 'Robotics' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Game development' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^ROS 2, level 0 of 5, 2.3 hours/ }),
    ).toBeInTheDocument();
    const balance = screen.getByRole('region', { name: 'Study balance' });
    expect(balance).toHaveTextContent('70 / 30');
    expect(balance).toHaveTextContent('2 h 20 min');
    expect(balance).toHaveTextContent('1 h');
    expect(balance).toHaveTextContent('Right on your split.');
  });

  it('opens a skill, records a project and sets a level by hand', async () => {
    await userEvent.click(await screen.findByRole('button', { name: /^ROS 2, level/ }));
    const sheet = screen.getByRole('dialog', { name: 'ROS 2' });
    expect(sheet).toHaveTextContent('AI & Robotics study (phone-free) · Daily');
    expect(sheet).toHaveTextContent('Level 1 needs 3 h');

    await userEvent.click(within(sheet).getByRole('button', { name: 'Add a finished project' }));
    const form = within(sheet).getByRole('form', { name: 'Add a finished project' });
    await userEvent.type(within(form).getByLabelText('Project'), 'TurtleBot nav');
    await userEvent.type(within(form).getByLabelText('Link (optional)'), 'https://github.com/r/t');
    await userEvent.type(within(form).getByLabelText('Hours spent (optional)'), '1');
    await userEvent.click(within(form).getByRole('button', { name: 'Save project' }));
    // 2 h 20 min + 1 h of project time → level 1.
    await waitFor(() => expect(sheet).toHaveTextContent('TurtleBot nav'));
    await waitFor(() => expect(sheet).toHaveTextContent('Level 1 of 5'));

    await userEvent.selectOptions(within(sheet).getByLabelText('Level'), '3');
    await waitFor(() => expect(sheet).toHaveTextContent('set by you (computed: 1)'));
    expect((await db.skills.get(ROS))?.manual_level_override).toBe(3);
  });

  it('adds a skill in a new branch that stays out of the split', async () => {
    await userEvent.click(await screen.findByRole('button', { name: 'Add skill' }));
    const form = screen.getByRole('form', { name: 'Add a skill' });
    await userEvent.selectOptions(within(form).getByLabelText('Branch'), 'New branch…');
    await userEvent.type(within(form).getByLabelText('New branch name'), 'Languages');
    await userEvent.type(within(form).getByLabelText('Skill'), 'German');
    await userEvent.click(within(form).getByRole('button', { name: 'Add skill' }));
    const branch = await screen.findByRole('region', { name: 'Languages' });
    expect(branch).toHaveTextContent('German');
    expect(branch).toHaveTextContent('Not in the 70/30 split');
  });
});

describe('wording', () => {
  it('balance notes and level rules come from the numbers', () => {
    expect(balanceNote(90, 70)).toMatch(/Games is a little behind/);
    expect(balanceNote(50, 70)).toMatch(/AI & Robotics is a little behind/);
    expect(levelRules()).toBe(
      'Level 1 at 3 h, 2 at 15 h, 3 at 50 h, 4 at 120 h with 1 project, 5 at 250 h with 2 projects.',
    );
  });
});
