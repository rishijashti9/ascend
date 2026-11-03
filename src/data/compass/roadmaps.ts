import type { z } from 'zod';
import { PROCESS_ROADMAPS } from './roadmapsProcess';
import { SKILL_ROADMAPS } from './roadmapsSkills';
import type { roadmapSchema } from './schema';

/** Learning roadmaps and guides (SPEC 6.7 B). Adding one = one entry in either file. */
export const ROADMAPS: z.input<typeof roadmapSchema>[] = [...SKILL_ROADMAPS, ...PROCESS_ROADMAPS];
