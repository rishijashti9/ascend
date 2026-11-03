import type { z } from 'zod';
import type { roadmapSchema } from './schema';

/** Learning roadmaps and guides (task 8.15 fills this in). */
export const ROADMAPS: z.input<typeof roadmapSchema>[] = [];
