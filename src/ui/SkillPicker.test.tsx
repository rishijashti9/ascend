import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { db } from '@/core/db/db';
import { clearSubscribers, recordAction } from '@/core/pipeline';
import { startSkills } from '@/core/state/skills';
import { seedSkillId } from '@/data/skills';
import { changesOf, editableOf } from '@/features/quests/habitDiff';
import { habitFieldsOf, STARTER_HABITS } from '@/data/starter';
import type { Habit } from '@/core/db/types';
import { SkillPicker } from './SkillPicker';

const ROS = seedSkillId('Robotics', 'ROS 2');
const CPP = seedSkillId('Robotics', 'C++');

function Harness({ onChange }: { onChange: (ids: string[]) => void }) {
  const [ids, setIds] = useState<string[]>([ROS]);
  return (
    <SkillPicker
      value={ids}
      onChange={(next) => {
        setIds(next);
        onChange(next);
      }}
    />
  );
}

beforeEach(async () => {
  await db.delete();
  await db.open();
  await recordAction({ type: 'skills.seed', source: 'system', payload: {} });
  await startSkills();
});
afterEach(() => clearSubscribers());

describe('SkillPicker', () => {
  it('shows the picked skills in one line and toggles chips by branch', async () => {
    const changes: string[][] = [];
    render(<Harness onChange={(ids) => changes.push(ids)} />);
    const summary = await screen.findByRole('button', { name: /Skills: ROS 2/ });
    await userEvent.click(summary);
    expect(screen.getByRole('button', { name: 'ROS 2' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'C++' }));
    await userEvent.click(screen.getByRole('button', { name: 'ROS 2' }));
    expect(changes.at(-1)).toEqual([CPP]);
    expect(screen.getByRole('button', { name: /Skills: C\+\+/ })).toBeInTheDocument();
  });
});

describe('habit edits', () => {
  it('a changed skill list is part of the habit update; an unchanged one is not', () => {
    const h = STARTER_HABITS.find((x) => x.key === 'ai-study');
    if (!h) throw new Error('starter missing');
    const habit = {
      schedule: [0, 1, 2, 3, 4, 5, 6],
      ...habitFieldsOf(h),
      id: 'h',
      skill_ids: [ROS],
    } as unknown as Habit;
    expect(changesOf(habit, editableOf(habit))).toEqual({});
    expect(changesOf(habit, { ...editableOf(habit), skill_ids: [ROS, CPP] })).toEqual({
      skill_ids: [ROS, CPP],
    });
  });
});
