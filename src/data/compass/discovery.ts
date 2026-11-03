import type { CareerField, Riasec } from './schema';

/**
 * Career discovery questions (SPEC 6.7 B). Interests follow the Holland / RIASEC model O*NET
 * uses (Realistic, Investigative, Artistic, Social, Enterprising, Conventional); the items
 * themselves are ASCEND's own wording. Strengths map to skills, values to fields.
 */
export const RIASEC_NAMES: Record<Riasec, { name: string; plain: string; short: string }> = {
  R: {
    name: 'Realistic',
    plain: 'building, fixing and working with your hands or machines',
    short: 'building and fixing things',
  },
  I: {
    name: 'Investigative',
    plain: 'figuring things out, science and solving hard problems',
    short: 'solving hard problems',
  },
  A: {
    name: 'Artistic',
    plain: 'creating, designing and expressing ideas',
    short: 'creating and designing',
  },
  S: { name: 'Social', plain: 'helping, teaching and caring for people', short: 'helping people' },
  E: {
    name: 'Enterprising',
    plain: 'leading, persuading and starting things',
    short: 'leading and persuading',
  },
  C: {
    name: 'Conventional',
    plain: 'organising, details and making systems run well',
    short: 'organising and details',
  },
};

export const INTEREST_ITEMS: { id: string; type: Riasec; text: string }[] = [
  { id: 'r1', type: 'R', text: 'Assemble or repair a machine or device' },
  { id: 'r2', type: 'R', text: 'Build something physical with tools' },
  { id: 'r3', type: 'R', text: 'Work outdoors or on a workshop floor' },
  { id: 'i1', type: 'I', text: 'Work out why an experiment or program behaves oddly' },
  { id: 'i2', type: 'I', text: 'Learn the maths or science behind how something works' },
  { id: 'i3', type: 'I', text: 'Spend hours on a hard problem until it clicks' },
  { id: 'a1', type: 'A', text: 'Design how something looks or feels' },
  { id: 'a2', type: 'A', text: 'Write, draw, compose or make videos' },
  { id: 'a3', type: 'A', text: 'Invent a world, a character or a game' },
  { id: 's1', type: 'S', text: 'Explain something until a friend understands it' },
  { id: 's2', type: 'S', text: 'Help someone through a difficult time' },
  { id: 's3', type: 'S', text: 'Look after people’s health or wellbeing' },
  { id: 'e1', type: 'E', text: 'Convince people to back an idea' },
  { id: 'e2', type: 'E', text: 'Lead a team towards a goal' },
  { id: 'e3', type: 'E', text: 'Start a project or small business of your own' },
  { id: 'c1', type: 'C', text: 'Keep records, budgets or schedules tidy and correct' },
  { id: 'c2', type: 'C', text: 'Follow a clear procedure and get every detail right' },
  { id: 'c3', type: 'C', text: 'Set up a system so things run smoothly' },
];

export const STRENGTHS: { id: string; label: string; skills: string[]; type: Riasec }[] = [
  {
    id: 'maths',
    label: 'Maths',
    skills: ['math-basics', 'linear-algebra', 'calculus', 'statistics'],
    type: 'I',
  },
  { id: 'coding', label: 'Coding', skills: ['programming-basics', 'python', 'cpp'], type: 'I' },
  {
    id: 'hands',
    label: 'Building with my hands',
    skills: ['workplace-safety', 'electronics-basics', 'cad'],
    type: 'R',
  },
  {
    id: 'design',
    label: 'Drawing and design',
    skills: ['visual-design', 'illustration', '3d-art'],
    type: 'A',
  },
  { id: 'writing', label: 'Writing', skills: ['writing', 'storytelling'], type: 'A' },
  {
    id: 'explaining',
    label: 'Explaining and teaching',
    skills: ['communication', 'teaching', 'public-speaking'],
    type: 'S',
  },
  { id: 'caring', label: 'Caring for people', skills: ['patient-care', 'counselling'], type: 'S' },
  {
    id: 'organising',
    label: 'Organising',
    skills: ['project-management', 'spreadsheets'],
    type: 'C',
  },
  {
    id: 'persuading',
    label: 'Persuading and leading',
    skills: ['sales', 'people-management', 'marketing'],
    type: 'E',
  },
  {
    id: 'science',
    label: 'Science and experiments',
    skills: ['physics', 'chemistry', 'biology', 'research-methods'],
    type: 'I',
  },
  { id: 'sport', label: 'Sport and fitness', skills: ['exercise-science', 'first-aid'], type: 'R' },
  { id: 'music', label: 'Music', skills: ['music-production'], type: 'A' },
];

export const VALUES: { id: string; label: string; fields: CareerField[] }[] = [
  { id: 'helping', label: 'Helping people directly', fields: ['health', 'education', 'public'] },
  { id: 'creating', label: 'Creating new things', fields: ['creative', 'tech', 'engineering'] },
  {
    id: 'discovery',
    label: 'Discovering how things work',
    fields: ['science', 'engineering', 'tech'],
  },
  {
    id: 'stability',
    label: 'Stability and a clear path',
    fields: ['health', 'education', 'public', 'trades', 'business'],
  },
  {
    id: 'income',
    label: 'High earning potential',
    fields: ['tech', 'business', 'engineering', 'health'],
  },
  { id: 'independence', label: 'Independence', fields: ['creative', 'business', 'trades'] },
  { id: 'hands-on', label: 'Hands-on, physical work', fields: ['trades', 'engineering'] },
  { id: 'leading', label: 'Leading and building teams', fields: ['business', 'public'] },
];
