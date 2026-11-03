import type { z } from 'zod';
import type { guidelineSchema, helplineSchema } from './schema';

/**
 * Health guidelines (SPEC 6.7 B health pillar) from WHO, ICMR-NIN and recognised sleep science
 * bodies. General guidance for healthy adults — never diagnosis or treatment. The numbers are
 * what the gap analysis compares real data against.
 */
export const GUIDELINES: z.input<typeof guidelineSchema>[] = [
  {
    id: 'activity-aerobic',
    topic: 'activity',
    title: 'Aerobic activity',
    audience: 'Adults 18–64',
    text: 'At least 150–300 minutes of moderate activity (brisk walking, cycling) or 75–150 minutes of vigorous activity a week, or a mix. Some is better than none; more brings more benefit.',
    numbers: { moderate_min_week: 150, moderate_max_week: 300, vigorous_min_week: 75 },
    sources: ['who-activity-2020', 'who-activity-facts'],
  },
  {
    id: 'activity-strength',
    topic: 'activity',
    title: 'Muscle strengthening',
    audience: 'Adults 18–64',
    text: 'Muscle-strengthening activity of moderate or greater intensity that works all major muscle groups on 2 or more days a week.',
    numbers: { strength_days_week: 2 },
    sources: ['who-activity-2020'],
  },
  {
    id: 'activity-sitting',
    topic: 'activity',
    title: 'Less sitting',
    audience: 'Adults 18–64',
    text: 'Limit time spent sitting; replacing it with activity of any intensity (even light) has health benefits. Long study days: stand and move every hour.',
    numbers: {},
    sources: ['who-activity-2020'],
  },
  {
    id: 'recovery-progression',
    topic: 'recovery',
    title: 'Start small, increase gradually',
    audience: 'Adults',
    text: 'Start with small amounts of activity and gradually increase how often, how hard and how long. Rest days and sleep are when the body adapts.',
    numbers: { max_weekly_increase_pct: 10 },
    sources: ['who-activity-2020'],
  },
  {
    id: 'sleep-duration',
    topic: 'sleep',
    title: 'Sleep duration',
    audience: 'Adults 18–60',
    text: 'Sleep 7 or more hours a night on a regular basis. Regularly sleeping less is linked with poorer health, mood and learning.',
    numbers: { min_hours: 7 },
    sources: ['aasm-sleep-2015'],
  },
  {
    id: 'diet-plate',
    topic: 'diet',
    title: 'A balanced Indian plate',
    audience: 'Adults',
    text: 'A varied diet: about half the plate vegetables and fruit, whole grains and millets (not only polished rice or maida), pulses such as dal, chana or rajma, curd or milk, and nuts and seeds. Cook with less oil.',
    numbers: { fruit_veg_g_day: 400 },
    sources: ['icmr-nin-2024', 'who-diet-facts'],
  },
  {
    id: 'diet-limits',
    topic: 'diet',
    title: 'Salt, sugar and fats',
    audience: 'Adults',
    text: 'Less than 5 g of salt a day (about a teaspoon), free sugars under 10% of energy (under 5% is better), and limit fried and ultra-processed foods.',
    numbers: { salt_g_day: 5, free_sugar_pct: 10 },
    sources: ['who-diet-facts', 'icmr-nin-2024'],
  },
  {
    id: 'diet-protein-veg',
    topic: 'diet',
    title: 'Protein on a vegetarian diet',
    audience: 'Adults',
    text: 'Combine cereals with pulses (rice with dal, roti with chana) at main meals, and add curd, milk, paneer, soya or nuts — together they cover protein needs for most people.',
    numbers: {},
    sources: ['icmr-nin-2024'],
  },
  {
    id: 'mental-wellbeing',
    topic: 'mental',
    title: 'Looking after your mind',
    audience: 'Everyone',
    text: 'Regular sleep, movement, time with people you trust and breaks from screens help wellbeing. If low mood, worry or stress keep affecting daily life, talking to someone you trust or a professional is a strong step, not a weak one.',
    numbers: {},
    sources: ['who-mental-facts'],
  },
];

/**
 * Mental health helplines by country. Tele-MANAS numbers are from its October 2022 launch; the
 * official site couldn't be checked automatically (DECISIONS task 8.18), so `verified` is null
 * and the official link is always shown with them. Germany and others: configurable later.
 */
export const HELPLINES: z.input<typeof helplineSchema>[] = [
  {
    country: 'IN',
    name: 'Tele-MANAS (Government of India)',
    phones: ['14416', '1-800-891-4416'],
    hours: 'Free, 24×7, in many Indian languages',
    url: 'https://telemanas.mohfw.gov.in/',
    verified: null,
    sources: ['tele-manas'],
  },
];
