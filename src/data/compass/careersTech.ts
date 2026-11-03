import type { z } from 'zod';
import type { careerSchema } from './schema';

type C = z.input<typeof careerSchema>;
const sk = (core: string[], useful: string[] = [], important: string[] = []) => [
  ...core.map((id) => ({ id, importance: 3 })),
  ...important.map((id) => ({ id, importance: 2 })),
  ...useful.map((id) => ({ id, importance: 1 })),
];

/**
 * Tech and engineering careers (SPEC 6.7 B). `deep: true` = detailed skill graph for Rishi's
 * path (robotics / AI / games). O*NET codes only where an O*NET occupation clearly matches;
 * careers without one (e.g. ML engineer) cite the official documentation they rely on.
 */
export const TECH_CAREERS: C[] = [
  // ---- Deep: AI & robotics (70%) and games (30%) ----
  {
    id: 'robotics-engineer',
    title: 'Robotics engineer',
    field: 'engineering',
    riasec: 'IRC',
    summary:
      'Designs, programs and tests robots — perception, motion, control and the software that ties them together, in research labs and companies building humanoids, arms and mobile robots.',
    skills: sk(
      ['cpp', 'ros2', 'kinematics-dynamics', 'control-systems', 'linear-algebra'],
      ['robot-simulation', 'git', 'embedded-systems', 'cad'],
      ['python', 'motion-planning', 'slam-navigation', 'computer-vision', 'linux'],
    ),
    entry:
      'Degree in robotics, mechatronics, mechanical, electrical or computer engineering (often a master’s for research roles) plus a portfolio of real robot projects.',
    onet: '17-2199.08',
    deep: true,
    sources: ['onet', 'ros2-docs', 'modern-robotics'],
  },
  {
    id: 'ml-engineer',
    title: 'Machine learning / AI engineer',
    field: 'tech',
    riasec: 'ICR',
    summary:
      'Builds, trains and ships machine-learning models — from data pipelines and training to deployment and monitoring in real products.',
    skills: sk(
      ['python', 'ml-fundamentals', 'deep-learning', 'linear-algebra', 'statistics'],
      ['cloud-devops', 'sql', 'nlp'],
      ['mlops', 'data-analysis', 'git', 'algorithms'],
    ),
    entry:
      'Degree in computer science, AI/data science, maths or engineering, plus shipped ML projects; research-heavy roles often expect a master’s or PhD.',
    deep: true,
    sources: ['google-mlcc', 'pytorch-docs', 'esco'],
  },
  {
    id: 'computer-vision-engineer',
    title: 'Computer vision engineer',
    field: 'tech',
    riasec: 'IRC',
    summary:
      'Makes machines see: detection, segmentation, tracking and 3D perception for robots, vehicles, inspection and AR.',
    skills: sk(
      ['computer-vision', 'deep-learning', 'python', 'linear-algebra'],
      ['ros2', 'mlops', 'signal-processing'],
      ['cpp', 'probability', 'git'],
    ),
    entry: 'Degree in CS, AI or engineering with vision projects; many roles prefer a master’s.',
    deep: true,
    sources: ['opencv-docs', 'pytorch-docs', 'esco'],
  },
  {
    id: 'controls-engineer',
    title: 'Controls engineer (robotics / mechatronics)',
    field: 'engineering',
    riasec: 'IRC',
    summary:
      'Designs the feedback controllers that keep robots, drones and machines stable and precise — modelling, tuning and testing on real hardware.',
    skills: sk(
      ['control-systems', 'kinematics-dynamics', 'linear-algebra', 'calculus'],
      ['ros2', 'robot-simulation', 'python'],
      ['cpp', 'embedded-systems', 'signal-processing', 'numerical-methods'],
    ),
    entry:
      'Degree in electrical, mechanical or mechatronics engineering; control-focused master’s common.',
    deep: true,
    sources: ['underactuated', 'modern-robotics', 'esco'],
  },
  {
    id: 'embedded-engineer',
    title: 'Embedded systems engineer',
    field: 'engineering',
    riasec: 'IRC',
    summary:
      'Writes the software that runs on microcontrollers inside robots and devices — drivers, real-time control loops and sensor interfaces.',
    skills: sk(
      ['cpp', 'embedded-systems', 'electronics-basics'],
      ['linux', 'testing', 'control-systems'],
      ['rtos', 'signal-processing', 'git'],
    ),
    entry:
      'Degree in electronics, electrical or computer engineering plus hands-on microcontroller projects.',
    deep: true,
    sources: ['arduino-docs', 'freertos', 'esco'],
  },
  {
    id: 'simulation-engineer',
    title: 'Simulation engineer (robotics)',
    field: 'engineering',
    riasec: 'IRC',
    summary:
      'Builds simulated worlds and robot models (Gazebo, Isaac Sim) to train and test robots safely before they touch hardware.',
    skills: sk(
      ['robot-simulation', 'ros2', 'cpp', 'kinematics-dynamics'],
      ['rendering', 'reinforcement-learning', 'game-math'],
      ['python', 'numerical-methods', 'linux'],
    ),
    entry: 'Degree in robotics, CS or mechanical engineering with simulation projects.',
    deep: true,
    sources: ['gazebo-docs', 'isaac-sim', 'ros2-docs'],
  },
  {
    id: 'game-programmer',
    title: 'Game programmer',
    field: 'tech',
    riasec: 'IRA',
    summary:
      'Writes the C++ that makes games work — gameplay systems, tools, physics, AI and performance — usually in Unreal Engine or a studio engine.',
    skills: sk(
      ['modern-cpp', 'unreal-engine', 'game-math', 'gameplay-systems'],
      ['rendering', 'git', 'game-design'],
      ['data-structures', 'algorithms', 'profiling'],
    ),
    entry:
      'Degree in CS or games programming, or self-taught — a portfolio of playable projects matters most.',
    deep: true,
    sources: ['unreal-docs', 'isocpp'],
  },
  {
    id: 'technical-artist',
    title: 'Technical artist',
    field: 'creative',
    riasec: 'AIR',
    summary:
      'Bridges art and engineering in games: shaders, materials, rigs, tools and pipelines that let artists work fast and look good in-engine.',
    skills: sk(
      ['shaders-materials', 'unreal-engine', '3d-art'],
      ['animation', 'profiling', 'cpp'],
      ['tech-art-tools', 'rendering', 'python', 'game-math'],
    ),
    entry: 'Art, games or CS background with a portfolio showing both art and technical work.',
    deep: true,
    sources: ['unreal-docs', 'blender-manual'],
  },
  // ---- Tech ----
  {
    id: 'software-developer',
    title: 'Software developer',
    field: 'tech',
    riasec: 'ICR',
    summary: 'Designs, builds and maintains software applications and systems.',
    skills: sk(
      ['programming-basics', 'data-structures', 'git'],
      ['system-design', 'sql'],
      ['algorithms', 'testing'],
    ),
    entry: 'Degree in CS or a related field, or a strong project portfolio.',
    onet: '15-1252.00',
    isco: '2512',
    sources: ['onet', 'esco'],
  },
  {
    id: 'web-developer',
    title: 'Web developer',
    field: 'tech',
    riasec: 'ICA',
    summary: 'Builds websites and web apps — the pages people use and the services behind them.',
    skills: sk(['web-frontend', 'git'], ['ux-design', 'testing'], ['web-backend', 'sql']),
    entry: 'Degree, bootcamp or self-taught with a portfolio of sites.',
    onet: '15-1254.00',
    isco: '2513',
    sources: ['onet', 'esco'],
  },
  {
    id: 'mobile-developer',
    title: 'Mobile app developer',
    field: 'tech',
    riasec: 'ICA',
    summary: 'Builds apps for Android and iOS phones and tablets.',
    skills: sk(
      ['mobile-dev', 'programming-basics'],
      ['ux-design', 'testing'],
      ['git', 'web-backend'],
    ),
    entry: 'CS degree or self-taught with published apps.',
    sources: ['onet', 'esco'],
  },
  {
    id: 'qa-engineer',
    title: 'Software QA / test engineer',
    field: 'tech',
    riasec: 'CIR',
    summary: 'Finds problems before users do — test plans, automated tests and quality checks.',
    skills: sk(['testing', 'programming-basics'], ['linux', 'sql'], ['git', 'communication']),
    entry: 'Degree or course in CS/IT; automation skills are valued.',
    onet: '15-1253.00',
    sources: ['onet'],
  },
  {
    id: 'data-scientist',
    title: 'Data scientist',
    field: 'tech',
    riasec: 'ICR',
    summary: 'Turns data into answers and predictions with statistics and machine learning.',
    skills: sk(
      ['statistics', 'python', 'data-analysis'],
      ['data-viz', 'communication'],
      ['ml-fundamentals', 'sql'],
    ),
    entry: 'Degree in data science, statistics, maths, CS or a quantitative field.',
    onet: '15-2051.00',
    sources: ['onet'],
  },
  {
    id: 'data-analyst',
    title: 'Data / business intelligence analyst',
    field: 'tech',
    riasec: 'CIE',
    summary: 'Finds patterns in business data and presents them in reports and dashboards.',
    skills: sk(
      ['sql', 'data-analysis', 'spreadsheets'],
      ['statistics', 'python'],
      ['data-viz', 'communication'],
    ),
    entry: 'Degree in business, statistics, economics or IT; SQL and a portfolio help most.',
    onet: '15-2051.01',
    sources: ['onet'],
  },
  {
    id: 'devops-engineer',
    title: 'DevOps / cloud engineer',
    field: 'tech',
    riasec: 'RIC',
    summary:
      'Keeps software running reliably in the cloud — automation, deployment pipelines and monitoring.',
    skills: sk(['cloud-devops', 'linux'], ['security', 'python'], ['git', 'networking']),
    entry: 'CS/IT degree or sysadmin experience; cloud certifications are common.',
    sources: ['onet', 'esco'],
  },
  {
    id: 'security-analyst',
    title: 'Information security analyst',
    field: 'tech',
    riasec: 'CIR',
    summary:
      'Protects systems and data — monitoring, investigating incidents and hardening defences.',
    skills: sk(['security', 'networking'], ['programming-basics', 'communication'], ['linux']),
    entry: 'Degree in CS/IT or security; certifications and hands-on labs help.',
    onet: '15-1212.00',
    sources: ['onet'],
  },
  {
    id: 'database-administrator',
    title: 'Database administrator',
    field: 'tech',
    riasec: 'CIR',
    summary: 'Runs databases so data is safe, fast and available.',
    skills: sk(['sql', 'linux'], ['security', 'cloud-devops'], ['data-structures']),
    entry: 'Degree in CS/IT and database experience.',
    onet: '15-1242.00',
    sources: ['onet'],
  },
  {
    id: 'network-administrator',
    title: 'Network and systems administrator',
    field: 'tech',
    riasec: 'RCI',
    summary: 'Sets up and maintains an organisation’s computers, servers and networks.',
    skills: sk(['networking', 'linux'], ['cloud-devops'], ['security']),
    entry: 'IT degree or diploma; certifications are common.',
    onet: '15-1244.00',
    isco: '2522',
    sources: ['onet', 'esco'],
  },
  {
    id: 'systems-analyst',
    title: 'Computer systems analyst',
    field: 'tech',
    riasec: 'ICE',
    summary: 'Works out how an organisation’s IT should work and designs better systems.',
    skills: sk(
      ['business-analysis', 'communication'],
      ['project-management'],
      ['sql', 'programming-basics'],
    ),
    entry: 'Degree in IS, CS or business with IT experience.',
    onet: '15-1211.00',
    isco: '2511',
    sources: ['onet', 'esco'],
  },
  {
    id: 'cs-research-scientist',
    title: 'Computer and AI research scientist',
    field: 'science',
    riasec: 'ICR',
    summary:
      'Invents new algorithms and methods in AI and computing, usually in labs and universities.',
    skills: sk(
      ['research-methods', 'algorithms', 'linear-algebra'],
      ['writing'],
      ['ml-fundamentals', 'probability', 'python'],
    ),
    entry: 'Master’s and usually a PhD in CS, AI or a related field; publications.',
    onet: '15-1221.00',
    sources: ['onet'],
  },
  {
    id: 'ux-designer',
    title: 'UX / digital interface designer',
    field: 'creative',
    riasec: 'AIE',
    summary: 'Designs how apps and websites look, feel and work for real people.',
    skills: sk(
      ['ux-design', 'visual-design'],
      ['web-frontend', 'research-methods'],
      ['communication'],
    ),
    entry: 'Design degree or course plus a portfolio of case studies.',
    onet: '15-1255.00',
    sources: ['onet'],
  },
  {
    id: 'game-designer',
    title: 'Video game designer',
    field: 'creative',
    riasec: 'AEI',
    summary: 'Designs game rules, levels and systems so a game is fun to play.',
    skills: sk(['game-design', 'communication'], ['writing', 'unreal-engine'], ['storytelling']),
    entry: 'Games degree or a portfolio of prototypes and levels.',
    onet: '15-1255.01',
    sources: ['onet'],
  },
];
