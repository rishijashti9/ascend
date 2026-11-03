import type { z } from 'zod';
import type { guidelineSchema, helplineSchema } from './schema';

/** Health guidelines (task 8.18 fills this in). */
export const GUIDELINES: z.input<typeof guidelineSchema>[] = [];
export const HELPLINES: z.input<typeof helplineSchema>[] = [];
