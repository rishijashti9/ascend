import type { z } from 'zod';
import type { skillSchema } from './schema';

/**
 * Skills with prerequisites (SPEC 6.7 B career pillar). `hours` = typical focused hours to a
 * solid working level — an estimate for planning, not a promise. `matches` = names in the
 * user's skill tree that count as this skill. Adding a skill is one entry here.
 */
type S = z.input<typeof skillSchema>;
const s = (
  id: string,
  name: string,
  hours: number,
  prereqs: string[] = [],
  extra: Partial<S> = {},
): S => ({ id, name, hours, prereqs, sources: ['onet'], ...extra });

export const SKILLS: S[] = [
  // ---- Foundations ----
  s('math-basics', 'Algebra and basic maths', 80),
  s('statistics', 'Statistics', 80, ['math-basics'], { matches: ['Statistics'] }),
  s('linear-algebra', 'Linear algebra', 100, ['math-basics'], {
    matches: ['Math for ML', 'Linear algebra'],
    learn: [
      {
        title: 'MIT 18.06 Linear Algebra',
        url: 'https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/',
      },
    ],
    sources: ['onet', 'mit-ocw-1806'],
  }),
  s('calculus', 'Calculus', 100, ['math-basics'], { matches: ['Calculus'] }),
  s('probability', 'Probability', 60, ['statistics', 'calculus'], { matches: ['Probability'] }),
  s('physics', 'Physics (mechanics, electricity)', 150, ['calculus']),
  s('chemistry', 'Chemistry', 150, ['math-basics']),
  s('biology', 'Biology', 150),
  s('communication', 'Clear communication', 40),
  s('writing', 'Writing', 60, ['communication']),
  s('public-speaking', 'Public speaking', 30, ['communication']),
  s('project-management', 'Project management', 80, ['communication']),
  s('research-methods', 'Research methods', 100, ['statistics', 'writing']),
  s('spreadsheets', 'Spreadsheets', 30, ['math-basics']),
  // ---- Programming ----
  s('programming-basics', 'Programming basics', 100, [], {
    learn: [{ title: 'The Python Tutorial', url: 'https://docs.python.org/3/tutorial/' }],
    sources: ['onet', 'python-docs'],
  }),
  s('python', 'Python', 120, ['programming-basics'], {
    matches: ['Python'],
    learn: [{ title: 'The Python Tutorial', url: 'https://docs.python.org/3/tutorial/' }],
    sources: ['onet', 'python-docs'],
  }),
  s('cpp', 'C++', 200, ['programming-basics'], {
    matches: ['C++', 'C++ for games'],
    learn: [
      { title: 'Get Started with C++ (isocpp.org)', url: 'https://isocpp.org/get-started' },
      { title: 'cppreference.com', url: 'https://en.cppreference.com/' },
    ],
    sources: ['onet', 'isocpp', 'cppreference'],
  }),
  s('modern-cpp', 'Modern C++ (C++17/20, RAII, templates)', 150, ['cpp'], {
    matches: ['C++ for games'],
    learn: [{ title: 'cppreference.com', url: 'https://en.cppreference.com/' }],
    sources: ['onet', 'cppreference'],
  }),
  s('data-structures', 'Data structures', 100, ['programming-basics']),
  s('algorithms', 'Algorithms', 120, ['data-structures', 'math-basics']),
  s('git', 'Git and version control', 20, [], {
    matches: ['Git'],
    learn: [{ title: 'Pro Git', url: 'https://git-scm.com/book/en/v2' }],
    sources: ['onet', 'git-docs'],
  }),
  s('linux', 'Linux and the command line', 40, [], { matches: ['Linux'] }),
  s('testing', 'Software testing', 40, ['programming-basics'], { matches: ['Testing'] }),
  s('sql', 'SQL and databases', 50, ['programming-basics']),
  s('web-frontend', 'Web front end (HTML, CSS, JavaScript)', 150, ['programming-basics']),
  s('web-backend', 'Web back end and APIs', 150, ['programming-basics', 'sql']),
  s('mobile-dev', 'Mobile app development', 150, ['programming-basics']),
  s('cloud-devops', 'Cloud and DevOps', 150, ['linux', 'git']),
  s('networking', 'Computer networking', 80, ['linux']),
  s('security', 'Security fundamentals', 120, ['networking']),
  s('system-design', 'System design', 100, ['data-structures', 'web-backend']),
  // ---- AI / ML ----
  s('data-analysis', 'Data analysis', 100, ['python', 'statistics', 'sql']),
  s('data-viz', 'Data visualisation', 40, ['data-analysis']),
  s(
    'ml-fundamentals',
    'Machine learning fundamentals',
    150,
    ['python', 'linear-algebra', 'statistics'],
    {
      learn: [
        {
          title: 'Machine Learning Crash Course (Google)',
          url: 'https://developers.google.com/machine-learning/crash-course',
        },
      ],
      sources: ['onet', 'google-mlcc'],
    },
  ),
  s('deep-learning', 'Deep learning', 200, ['ml-fundamentals', 'calculus'], {
    matches: ['Deep learning'],
    learn: [{ title: 'PyTorch Tutorials', url: 'https://pytorch.org/tutorials/' }],
    sources: ['onet', 'pytorch-docs'],
  }),
  s('computer-vision', 'Computer vision', 150, ['deep-learning'], {
    matches: ['Computer vision'],
    learn: [{ title: 'OpenCV Documentation', url: 'https://docs.opencv.org/' }],
    sources: ['onet', 'opencv-docs'],
  }),
  s('reinforcement-learning', 'Reinforcement learning', 150, ['deep-learning', 'probability'], {
    matches: ['Reinforcement learning'],
  }),
  s('nlp', 'Natural language processing', 120, ['deep-learning']),
  s('mlops', 'MLOps (deploying and monitoring models)', 100, ['ml-fundamentals', 'cloud-devops']),
  // ---- Robotics ----
  s('ros2', 'ROS 2', 150, ['cpp', 'python', 'linux'], {
    matches: ['ROS 2', 'ROS'],
    learn: [
      {
        title: 'ROS 2 Documentation (tutorials)',
        url: 'https://docs.ros.org/en/rolling/Tutorials.html',
      },
    ],
    sources: ['onet', 'ros2-docs'],
  }),
  s(
    'kinematics-dynamics',
    'Kinematics and dynamics',
    120,
    ['linear-algebra', 'calculus', 'physics'],
    {
      matches: ['Kinematics & dynamics', 'Kinematics'],
      learn: [
        {
          title: 'Modern Robotics (Lynch & Park)',
          url: 'https://hades.mech.northwestern.edu/index.php/Modern_Robotics',
        },
      ],
      sources: ['onet', 'modern-robotics'],
    },
  ),
  s('control-systems', 'Control systems', 150, ['calculus', 'linear-algebra'], {
    matches: ['Control'],
    learn: [{ title: 'Underactuated Robotics (MIT)', url: 'https://underactuated.mit.edu/' }],
    sources: ['onet', 'underactuated'],
  }),
  s('motion-planning', 'Motion planning', 100, ['algorithms', 'kinematics-dynamics'], {
    sources: ['onet', 'modern-robotics'],
  }),
  s('signal-processing', 'Signal processing', 100, ['calculus', 'linear-algebra']),
  s('sensor-fusion', 'Sensor fusion and state estimation', 100, [
    'probability',
    'signal-processing',
  ]),
  s(
    'slam-navigation',
    'SLAM and navigation',
    150,
    ['ros2', 'sensor-fusion', 'kinematics-dynamics'],
    {
      matches: ['SLAM & navigation', 'SLAM'],
      sources: ['onet', 'ros2-docs'],
    },
  ),
  s('robot-simulation', 'Robot simulation (Gazebo, Isaac Sim)', 80, ['ros2'], {
    matches: ['Simulation'],
    learn: [
      { title: 'Gazebo Documentation', url: 'https://gazebosim.org/docs' },
      { title: 'NVIDIA Isaac Sim', url: 'https://developer.nvidia.com/isaac/sim' },
    ],
    sources: ['onet', 'gazebo-docs', 'isaac-sim'],
  }),
  s('electronics-basics', 'Electronics basics', 80, ['math-basics'], {
    matches: ['Embedded/electronics basics', 'Electronics'],
    learn: [{ title: 'Arduino Documentation', url: 'https://docs.arduino.cc/' }],
    sources: ['onet', 'arduino-docs'],
  }),
  s(
    'embedded-systems',
    'Embedded systems and microcontrollers',
    150,
    ['cpp', 'electronics-basics'],
    {
      matches: ['Embedded/electronics basics', 'Embedded'],
      learn: [{ title: 'Arduino Documentation', url: 'https://docs.arduino.cc/' }],
      sources: ['onet', 'arduino-docs'],
    },
  ),
  s('rtos', 'Real-time operating systems', 60, ['embedded-systems'], {
    learn: [{ title: 'FreeRTOS Documentation', url: 'https://www.freertos.org/' }],
    sources: ['onet', 'freertos'],
  }),
  s('cad', 'CAD and mechanical design', 100, ['math-basics']),
  s('numerical-methods', 'Numerical methods and physics simulation', 100, [
    'calculus',
    'linear-algebra',
    'programming-basics',
  ]),
  // ---- Games ----
  s('game-math', 'Game maths (vectors, matrices, quaternions)', 60, ['linear-algebra'], {
    matches: ['Game math'],
  }),
  s('unreal-engine', 'Unreal Engine', 150, ['cpp'], {
    matches: ['Unreal Engine'],
    learn: [
      {
        title: 'Unreal Engine Documentation',
        url: 'https://dev.epicgames.com/documentation/en-us/unreal-engine',
      },
    ],
    sources: ['onet', 'unreal-docs'],
  }),
  s('gameplay-systems', 'Gameplay systems', 120, ['unreal-engine', 'modern-cpp'], {
    matches: ['Gameplay systems'],
    sources: ['onet', 'unreal-docs'],
  }),
  s('rendering', 'Real-time rendering', 150, ['game-math', 'cpp'], {
    matches: ['Rendering basics'],
  }),
  s('shaders-materials', 'Shaders and materials', 80, ['rendering'], {
    sources: ['onet', 'unreal-docs'],
  }),
  s('3d-art', '3D modelling and texturing', 150, [], {
    learn: [{ title: 'Blender Manual', url: 'https://docs.blender.org/manual/en/latest/' }],
    sources: ['onet', 'blender-manual'],
  }),
  s('tech-art-tools', 'Pipeline tools and scripting for art', 80, ['python', '3d-art']),
  s('profiling', 'Performance profiling and optimisation', 60, ['cpp']),
  s('game-design', 'Game design', 100, ['communication']),
  // ---- Creative ----
  s('visual-design', 'Visual and graphic design', 150),
  s('ux-design', 'UX and interaction design', 150, ['visual-design', 'communication']),
  s('illustration', 'Drawing and illustration', 200),
  s('animation', 'Animation', 200, ['illustration']),
  s('photography', 'Photography', 100),
  s('video-editing', 'Video editing', 80),
  s('music-production', 'Music production', 200),
  s('storytelling', 'Storytelling', 60, ['writing']),
  s('space-planning', 'Space planning and interior design', 150, ['visual-design']),
  // ---- Business and law ----
  s('accounting', 'Accounting', 150, ['spreadsheets']),
  s('finance', 'Finance and valuation', 150, ['accounting', 'statistics']),
  s('marketing', 'Marketing', 100, ['communication']),
  s('sales', 'Selling and negotiation', 60, ['communication']),
  s('product-management', 'Product management', 120, ['communication', 'project-management']),
  s('people-management', 'People and HR management', 100, ['communication']),
  s('business-analysis', 'Business analysis', 100, ['spreadsheets', 'communication']),
  s('legal-research', 'Legal research and writing', 200, ['writing']),
  // ---- Health ----
  s('anatomy-physiology', 'Anatomy and physiology', 200, ['biology']),
  s('patient-care', 'Patient care', 150, ['communication', 'anatomy-physiology']),
  s('pharmacology', 'Pharmacology', 200, ['anatomy-physiology', 'chemistry']),
  s('first-aid', 'First aid and CPR', 10),
  s('nutrition-science', 'Nutrition science', 150, ['biology']),
  s('exercise-science', 'Exercise science', 150, ['anatomy-physiology']),
  s('counselling', 'Counselling skills', 200, ['communication']),
  s('lab-techniques', 'Laboratory techniques', 150, ['chemistry', 'biology']),
  s('clinical-practice', 'Supervised clinical practice', 500, ['patient-care']),
  // ---- Skilled trades ----
  s('workplace-safety', 'Workplace safety', 20),
  s('blueprint-reading', 'Reading drawings and blueprints', 40, ['math-basics']),
  s('electrical-installation', 'Electrical installation (apprenticeship)', 1000, [
    'electronics-basics',
    'workplace-safety',
  ]),
  s('plumbing', 'Plumbing systems (apprenticeship)', 1000, [
    'blueprint-reading',
    'workplace-safety',
  ]),
  s('carpentry', 'Carpentry and joinery (apprenticeship)', 1000, [
    'blueprint-reading',
    'workplace-safety',
  ]),
  s('welding', 'Welding (apprenticeship or course)', 600, ['workplace-safety']),
  s('vehicle-repair', 'Vehicle diagnostics and repair', 1000, [
    'electronics-basics',
    'workplace-safety',
  ]),
  s('hvac', 'Heating, ventilation and cooling systems', 1000, [
    'electronics-basics',
    'workplace-safety',
  ]),
  s('machining', 'Machining and CNC', 600, ['blueprint-reading', 'workplace-safety']),
  // ---- Education and public service ----
  s('teaching', 'Teaching and lesson design', 150, ['communication']),
  s('classroom-management', 'Classroom management', 80, ['teaching']),
  s('instructional-design', 'Instructional design', 100, ['teaching', 'writing']),
  s('case-management', 'Case management', 100, ['communication']),
  s('policy-analysis', 'Policy analysis', 150, ['research-methods']),
  s('emergency-response', 'Emergency response', 200, ['first-aid', 'workplace-safety']),
  s('information-organisation', 'Organising information and collections', 100),
];
