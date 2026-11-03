import type { z } from 'zod';
import type { skillSchema } from './schema';

/** Skills with prerequisites (task 8.14 fills this in). One entry per skill. */
export const SKILLS: z.input<typeof skillSchema>[] = [];
