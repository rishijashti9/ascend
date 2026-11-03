import type { SkillTrack } from '@/core/db/types';

/**
 * The starter skill tree — Rishi's roadmap (SPEC 6.5). Seeded once per device with
 * deterministic ids, so every device makes the same records and edits sync normally.
 * Branches and skills are editable in the app; this file is only the starting point.
 */
export interface SeedBranch {
  branch: string;
  track: SkillTrack;
  skills: string[];
}

export const SKILL_SEED: readonly SeedBranch[] = [
  {
    branch: 'AI & ML',
    track: 'ai_robotics',
    skills: ['Python', 'Math for ML', 'Deep learning', 'Computer vision', 'Reinforcement learning'],
  },
  {
    branch: 'Robotics',
    track: 'ai_robotics',
    skills: [
      'C++',
      'ROS 2',
      'Kinematics & dynamics',
      'Control',
      'SLAM & navigation',
      'Simulation (Gazebo / Isaac Sim)',
      'Embedded & electronics basics',
    ],
  },
  {
    branch: 'Game development',
    track: 'games',
    skills: ['C++ for games', 'Unreal Engine', 'Game math', 'Gameplay systems', 'Rendering basics'],
  },
  {
    branch: 'Engineering',
    track: 'other',
    skills: ['Git', 'Linux', 'Testing'],
  },
];

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/\+/g, 'p')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Deterministic id of a seeded skill, e.g. `skill:robotics:ros-2`. */
export function seedSkillId(branch: string, name: string): string {
  return `skill:${slug(branch)}:${slug(name)}`;
}

/** Track labels used on the Skills screen. */
export const TRACK_LABEL: Record<SkillTrack, string> = {
  ai_robotics: 'AI & Robotics',
  games: 'Games',
  other: 'Not in the 70/30 split',
};
