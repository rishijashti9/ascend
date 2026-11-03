import type { z } from 'zod';
import type { roadmapSchema } from './schema';

type R = z.input<typeof roadmapSchema>;

/**
 * Exams, the German university process and study science (SPEC 6.7 B). Durations are typical,
 * not promises; anything that changes (fees, deadlines, processing times, amounts) points to
 * the official site with `checkOfficial`.
 */
export const PROCESS_ROADMAPS: R[] = [
  {
    id: 'ielts',
    title: 'IELTS Academic',
    kind: 'exam',
    summary:
      'Prepare for the four parts — Listening, Reading, Writing, Speaking — and book the test.',
    steps: [
      {
        title: 'Diagnostic test',
        weeks: 1,
        detail: 'One timed practice test to see your band per skill.',
        checkOfficial: 'https://ielts.org/take-a-test/preparation-resources',
      },
      {
        title: 'Skill-by-skill practice',
        weeks: 6,
        detail:
          'Daily work on your weakest skill; Writing Task 1 and 2 with feedback; Speaking out loud.',
      },
      {
        title: 'Full timed mock tests',
        weeks: 2,
        detail: 'Two or more complete mocks under real timing.',
      },
      {
        title: 'Book the test',
        weeks: 1,
        detail:
          'Choose computer or paper and a date before your application deadline. Fees and result times vary.',
        checkOfficial: 'https://ielts.org/',
      },
      {
        title: 'Test and results',
        weeks: 2,
        detail:
          'Results usually take days (computer) to about two weeks (paper) — check current times.',
        checkOfficial: 'https://ielts.org/',
      },
    ],
    sources: ['ielts'],
  },
  {
    id: 'gre',
    title: 'GRE General Test',
    kind: 'exam',
    summary:
      'Quantitative, Verbal and Analytical Writing — only if your target programmes ask for it.',
    steps: [
      {
        title: 'Check which programmes require it',
        weeks: 1,
        detail: 'Many German programmes don’t; some (and many US ones) do or recommend it.',
        checkOfficial: 'https://www.daad.de/en/',
      },
      {
        title: 'Diagnostic with official practice',
        weeks: 1,
        detail: 'Take the free official ETS practice test to find your starting score.',
        checkOfficial: 'https://www.ets.org/gre.html',
      },
      {
        title: 'Quantitative review',
        weeks: 4,
        detail: 'Arithmetic, algebra, geometry and data analysis — mostly speed and accuracy.',
      },
      {
        title: 'Verbal and writing',
        weeks: 4,
        detail: 'Reading comprehension, text completion and one Analyze an Issue essay each week.',
      },
      {
        title: 'Mocks, then the test',
        weeks: 2,
        detail:
          'Two full official practice tests, then book. Format, fees and score validity are on the ETS site.',
        checkOfficial: 'https://www.ets.org/gre.html',
      },
    ],
    sources: ['gre', 'daad'],
  },
  {
    id: 'germany-masters',
    title: 'Master’s in Germany from India (APS route)',
    kind: 'process',
    summary: 'From choosing programmes to enrolling — APS certificate, tests, applications, visa.',
    steps: [
      {
        title: 'Shortlist programmes and requirements',
        weeks: 4,
        detail:
          'Use DAAD’s international programmes search; note each programme’s language, test and deadline requirements.',
        checkOfficial: 'https://www.daad.de/en/',
      },
      {
        title: 'APS certificate',
        weeks: 8,
        detail:
          'Required for Indian applicants to German universities. Apply early with your documents; processing can take weeks to months.',
        checkOfficial: 'https://www.aps-india.de/',
      },
      {
        title: 'Language test (and GRE if required)',
        weeks: 12,
        detail:
          'IELTS (or TOEFL) to the programme’s minimum; GRE only where asked. Run in parallel with APS.',
      },
      {
        title: 'CV, motivation letter, recommendations',
        weeks: 4,
        detail:
          'A clear CV, one tailored motivation letter per programme and two or three recommendation letters.',
      },
      {
        title: 'Apply (uni-assist or university portal)',
        weeks: 6,
        detail:
          'Winter-semester deadlines are often in spring/summer, some much earlier; uni-assist checks take weeks.',
        checkOfficial: 'https://www.uni-assist.de/en/',
      },
      {
        title: 'Admission, blocked account, insurance',
        weeks: 4,
        detail:
          'After admission: blocked account (the required amount changes yearly) and health insurance.',
        checkOfficial: 'https://india.diplo.de/',
      },
      {
        title: 'Student visa',
        weeks: 8,
        detail: 'Book the visa appointment as early as possible — waiting times vary.',
        checkOfficial: 'https://india.diplo.de/',
      },
      {
        title: 'Travel, housing and enrolment',
        weeks: 4,
        detail:
          'Find accommodation early, then enrol at the university and register your address in Germany.',
      },
    ],
    sources: ['daad', 'aps-india', 'uni-assist', 'german-missions-india', 'ielts', 'gre'],
  },
  {
    id: 'spaced-repetition',
    title: 'Remember what you study (spaced repetition + practice testing)',
    kind: 'study',
    summary:
      'Testing yourself and spreading reviews over time are the two study methods with the strongest evidence.',
    steps: [
      {
        title: 'Turn each session into questions',
        weeks: 0,
        detail: 'End every study block by writing 3–5 questions or flashcards on what you learned.',
      },
      {
        title: 'Review on a widening schedule',
        weeks: 0,
        detail:
          'Answer them next day, after 3 days, a week, two weeks, a month — before you forget, not after.',
      },
      {
        title: 'Test, don’t reread',
        weeks: 0,
        detail:
          'Recall the answer before looking; rereading and highlighting feel good but help much less.',
      },
      {
        title: 'Mix related topics',
        weeks: 0,
        detail:
          'Interleave problem types in practice instead of doing 20 of the same kind in a row.',
      },
    ],
    sources: ['dunlosky-2013', 'cepeda-2006'],
  },
  {
    id: 'deep-work',
    title: 'Deep focus blocks',
    kind: 'study',
    summary:
      'Long single-task blocks with the phone out of reach — attention is a limited resource.',
    steps: [
      {
        title: 'Phone in another room',
        weeks: 0,
        detail: 'Even a silent phone on the desk measurably reduces available attention.',
      },
      {
        title: 'One task, one goal per block',
        weeks: 0,
        detail:
          'Decide the block’s single outcome first; switching between tasks costs control and accuracy.',
      },
      {
        title: '50–90 minutes, then a real break',
        weeks: 0,
        detail: 'Use the focus timer; a short walk beats scrolling during breaks.',
      },
      {
        title: 'Same time each day',
        weeks: 0,
        detail: 'Put deep blocks at your learned best focus time so starting takes less willpower.',
      },
    ],
    sources: ['ward-2017', 'ophir-2009'],
  },
  {
    id: 'restart-after-break',
    title: 'Restarting after a break',
    kind: 'study',
    summary: 'Missing days doesn’t erase a habit — restarting small and soon is what matters.',
    steps: [
      {
        title: 'Restart at the minimum',
        weeks: 0,
        detail: 'Day one back: only the minimum versions. Make it easy to win.',
      },
      {
        title: 'Same cue, same time',
        weeks: 0,
        detail: 'Habits form from repeating the same action in the same situation.',
      },
      {
        title: 'Don’t try to catch up',
        weeks: 0,
        detail: 'Doubling the work to “make up” for lost days is the fastest way to stop again.',
      },
      {
        title: 'Build back over two weeks',
        weeks: 2,
        detail:
          'Let the System raise targets again as you’re reaching them; missing a single day barely affects the habit.',
      },
    ],
    sources: ['lally-2010'],
  },
];
