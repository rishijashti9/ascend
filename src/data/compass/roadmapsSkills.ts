import type { z } from 'zod';
import type { roadmapSchema } from './schema';

type R = z.input<typeof roadmapSchema>;

/**
 * Skill roadmaps for the robotics / AI / games path (SPEC 6.7 B). Weeks are typical at about
 * 1–2 focused hours a day; the Goal Planner rescales them to the user's real pace.
 */
export const SKILL_ROADMAPS: R[] = [
  {
    id: 'ai-ml',
    title: 'AI & machine learning',
    kind: 'skill',
    summary: 'From Python and the maths to deep learning, one speciality and deployed projects.',
    steps: [
      {
        title: 'Python for data work',
        weeks: 4,
        skill: 'python',
        detail: 'Python basics, NumPy and pandas; write small scripts every day.',
      },
      {
        title: 'The maths: linear algebra, statistics, calculus',
        weeks: 8,
        skill: 'linear-algebra',
        detail:
          'Vectors, matrices, derivatives, distributions — enough to read ML papers. MIT 18.06 for linear algebra.',
      },
      {
        title: 'Machine learning fundamentals',
        weeks: 6,
        skill: 'ml-fundamentals',
        detail:
          'Regression, classification, overfitting, evaluation. Google’s ML Crash Course, then one end-to-end project.',
      },
      {
        title: 'Deep learning with PyTorch',
        weeks: 8,
        skill: 'deep-learning',
        detail:
          'Tensors, autograd, training loops, CNNs and transformers through the official PyTorch tutorials.',
      },
      {
        title: 'A speciality: vision or reinforcement learning',
        weeks: 8,
        skill: 'computer-vision',
        detail: 'Pick the one closest to robotics. Reproduce a known result, then extend it.',
      },
      {
        title: 'Deploy and portfolio',
        weeks: 4,
        skill: 'mlops',
        detail:
          'Ship one model behind an API or on a robot; write it up on GitHub with results and limits.',
      },
    ],
    sources: ['google-mlcc', 'pytorch-docs', 'mit-ocw-1806'],
  },
  {
    id: 'ros2',
    title: 'ROS 2',
    kind: 'skill',
    summary: 'From the command line to a robot that navigates in simulation and on hardware.',
    steps: [
      {
        title: 'Linux and C++/Python basics',
        weeks: 3,
        skill: 'linux',
        detail: 'Terminal, packages, building C++ and running Python — ROS 2 assumes both.',
      },
      {
        title: 'Beginner tutorials: nodes, topics, services, actions',
        weeks: 3,
        skill: 'ros2',
        detail: 'Work through the official CLI and client-library tutorials (rclcpp and rclpy).',
      },
      {
        title: 'Launch files, parameters and tf2',
        weeks: 3,
        skill: 'ros2',
        detail: 'Bring up multi-node systems and keep coordinate frames right.',
      },
      {
        title: 'Robot description (URDF) and simulation',
        weeks: 3,
        skill: 'robot-simulation',
        detail: 'Model a robot in URDF and drive it in Gazebo through ROS 2.',
      },
      {
        title: 'Navigation or manipulation',
        weeks: 6,
        skill: 'slam-navigation',
        detail: 'Nav2 for mobile robots or MoveIt 2 for arms — map, plan and move.',
      },
      {
        title: 'A complete project',
        weeks: 6,
        detail:
          'One robot (simulated or real) doing a useful task end to end, documented on GitHub.',
      },
    ],
    sources: ['ros2-docs', 'gazebo-docs'],
  },
  {
    id: 'cpp',
    title: 'C++',
    kind: 'skill',
    summary: 'Modern C++ for robotics and games — correct first, then fast.',
    steps: [
      {
        title: 'Core language',
        weeks: 4,
        skill: 'cpp',
        detail: 'Types, functions, references, classes; compile and debug small programs.',
      },
      {
        title: 'The standard library',
        weeks: 3,
        skill: 'cpp',
        detail:
          'Containers, algorithms, strings and iterators — prefer them to hand-written loops.',
      },
      {
        title: 'Memory, RAII and smart pointers',
        weeks: 3,
        skill: 'modern-cpp',
        detail: 'Ownership, unique_ptr/shared_ptr, move semantics; no raw new/delete.',
      },
      {
        title: 'Templates and modern features',
        weeks: 4,
        skill: 'modern-cpp',
        detail: 'Templates, lambdas, constexpr, ranges (C++17/20). cppreference is the reference.',
      },
      {
        title: 'Build, test, profile',
        weeks: 3,
        skill: 'testing',
        detail: 'CMake, unit tests and a profiler — how real C++ projects are run.',
      },
      {
        title: 'Concurrency and a project',
        weeks: 5,
        skill: 'profiling',
        detail:
          'Threads and atomics, then one performance-sensitive project (a ROS 2 node or game system).',
      },
    ],
    sources: ['isocpp', 'cppreference'],
  },
  {
    id: 'robotics-math',
    title: 'Robotics maths',
    kind: 'skill',
    summary: 'The maths behind moving robots: linear algebra to dynamics and control.',
    steps: [
      {
        title: 'Linear algebra',
        weeks: 6,
        skill: 'linear-algebra',
        detail: 'MIT 18.06: matrices, eigenvalues, least squares.',
      },
      {
        title: 'Calculus and differential equations',
        weeks: 5,
        skill: 'calculus',
        detail: 'Derivatives, integrals and ODEs — how systems change over time.',
      },
      {
        title: 'Probability for robotics',
        weeks: 3,
        skill: 'probability',
        detail: 'Bayes’ rule and Gaussians — the base of filtering and SLAM.',
      },
      {
        title: 'Rigid-body motion and transforms',
        weeks: 3,
        skill: 'kinematics-dynamics',
        detail: 'Rotations, homogeneous transforms and twists (Modern Robotics ch. 3).',
      },
      {
        title: 'Kinematics',
        weeks: 4,
        skill: 'kinematics-dynamics',
        detail: 'Forward and inverse kinematics, Jacobians (Modern Robotics ch. 4–6).',
      },
      {
        title: 'Dynamics and control',
        weeks: 6,
        skill: 'control-systems',
        detail: 'Robot dynamics (ch. 8), then feedback control and stability.',
      },
    ],
    sources: ['mit-ocw-1806', 'modern-robotics', 'underactuated'],
  },
  {
    id: 'robot-simulation',
    title: 'Robot simulation',
    kind: 'skill',
    summary: 'Build, test and train robots in simulation before touching hardware.',
    steps: [
      {
        title: 'Gazebo basics',
        weeks: 2,
        skill: 'robot-simulation',
        detail: 'Worlds, models and plugins in the official Gazebo tutorials.',
      },
      {
        title: 'Robot models (URDF/SDF)',
        weeks: 2,
        skill: 'robot-simulation',
        detail: 'Describe links, joints, inertia and collisions correctly.',
      },
      {
        title: 'Simulated sensors',
        weeks: 2,
        skill: 'sensor-fusion',
        detail: 'Cameras, lidar and IMUs with realistic noise.',
      },
      {
        title: 'ROS 2 integration',
        weeks: 3,
        skill: 'ros2',
        detail: 'Control the simulated robot from ROS 2 exactly like a real one.',
      },
      {
        title: 'Isaac Sim and learning environments',
        weeks: 4,
        skill: 'reinforcement-learning',
        detail: 'GPU simulation for perception and reinforcement learning.',
      },
      {
        title: 'Sim-to-real',
        weeks: 3,
        detail: 'Domain randomisation and checking what transfers to the real robot.',
      },
    ],
    sources: ['gazebo-docs', 'isaac-sim', 'ros2-docs'],
  },
  {
    id: 'unreal-engine',
    title: 'Unreal Engine (C++)',
    kind: 'skill',
    summary: 'From the editor to C++ gameplay systems and a finished small game.',
    steps: [
      {
        title: 'Editor and Blueprints',
        weeks: 3,
        skill: 'unreal-engine',
        detail: 'Levels, actors and Blueprint scripting through the official learning paths.',
      },
      {
        title: 'C++ in Unreal',
        weeks: 4,
        skill: 'unreal-engine',
        detail: 'UObject, Actors, Components, reflection macros and the build system.',
      },
      {
        title: 'Gameplay framework',
        weeks: 4,
        skill: 'gameplay-systems',
        detail: 'GameMode, Pawn/Character, controllers, input and game state.',
      },
      {
        title: 'Materials, UI and animation',
        weeks: 3,
        skill: 'shaders-materials',
        detail: 'Material editor, UMG interfaces and animation blueprints.',
      },
      {
        title: 'A small finished game',
        weeks: 6,
        skill: 'gameplay-systems',
        detail: 'Scope it tiny and finish it — a polished small game beats a big unfinished one.',
      },
      {
        title: 'Profiling and going further',
        weeks: 3,
        skill: 'profiling',
        detail: 'Unreal Insights for performance; then a system like abilities or networking.',
      },
    ],
    sources: ['unreal-docs', 'isocpp'],
  },
];
