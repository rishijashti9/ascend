import type { z } from 'zod';
import type { careerSchema } from './schema';

/** Careers (task 8.14 fills this in). One entry per career. */
export const CAREERS: z.input<typeof careerSchema>[] = [];
