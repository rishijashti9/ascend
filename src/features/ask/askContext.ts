/**
 * What the Ask sheet knows about the screen you came from (Phase 12): its name, questions that
 * fit it, and an extra line where needed. Only the question you send leaves the device — the
 * screen itself is never sent. On Body the answer stays general: your sleep, steps, weight and
 * mood are never part of what Ask can send (the allow-list in core/ask/context.ts).
 */
export interface AskScreen {
  name: string;
  suggestions: string[];
  note?: string;
}

const SCREENS: { match: RegExp; screen: AskScreen }[] = [
  {
    match: /^\/me\/body/,
    screen: {
      name: 'Body',
      suggestions: [
        'How much sleep do adults need?',
        'How do I start strength training safely?',
        'What does a balanced Indian vegetarian plate look like?',
      ],
      note: 'General health answers only — your sleep, steps, weight and mood never leave this device.',
    },
  },
  {
    match: /^\/me\/screen-time/,
    screen: {
      name: 'Screen time',
      suggestions: [
        'How can I stop scrolling late at night?',
        'How do I take a break from my phone without missing out?',
      ],
    },
  },
  {
    match: /^\/me\/reviews/,
    screen: {
      name: 'Reviews',
      suggestions: [
        'How do I run a good weekly review?',
        'How do I learn from a week that went badly?',
      ],
    },
  },
  {
    match: /^\/me/,
    screen: {
      name: 'Me',
      suggestions: [
        'How can I raise my weakest area without burning out?',
        'How do I stay consistent for years, not weeks?',
      ],
    },
  },
  {
    match: /^\/growth\/compass/,
    screen: {
      name: 'Compass',
      suggestions: [
        'What should I learn after ROS 2 basics to work on humanoid robots?',
        'How do I prepare for an MS in robotics in Germany?',
        'How long does it take to get good at C++ for robotics?',
      ],
    },
  },
  {
    match: /^\/growth\/skills/,
    screen: {
      name: 'Skills',
      suggestions: [
        'Which skill should I learn next for robotics?',
        'How do I practise C++ effectively?',
      ],
    },
  },
  {
    match: /^\/growth\/jobs/,
    screen: {
      name: 'Jobs',
      suggestions: [
        'How do I write a strong robotics CV?',
        'How should I prepare for a robotics internship interview?',
      ],
    },
  },
  {
    match: /^\/growth/,
    screen: {
      name: 'Goals',
      suggestions: [
        'How do I break a big goal into weekly steps?',
        'What should I do when I fall behind on a goal?',
      ],
    },
  },
  {
    match: /^\/focus/,
    screen: {
      name: 'Focus',
      suggestions: [
        'How long should a deep-work session be?',
        'How do I stop getting distracted while studying?',
      ],
    },
  },
  {
    match: /^\/quests/,
    screen: {
      name: 'Quests',
      suggestions: [
        'How many daily habits are realistic to start with?',
        'How do I make a habit easier to start?',
      ],
    },
  },
];

const TODAY: AskScreen = {
  name: 'Today',
  suggestions: [
    'How do I build a morning routine that sticks?',
    'How can I stay consistent when motivation drops?',
    'How should I split study time between robotics and game dev?',
  ],
};

export function askScreenFor(pathname: string): AskScreen {
  return SCREENS.find((s) => s.match.test(pathname))?.screen ?? TODAY;
}
