import type { z } from 'zod';
import { ENGINEERING_CAREERS } from './careersEngineering';
import { OTHER_CAREERS } from './careersOther';
import { TECH_CAREERS } from './careersTech';
import type { careerSchema } from './schema';

/** Every career (SPEC 6.7 B). Adding a career = one entry in one of these files. */
export const CAREERS: z.input<typeof careerSchema>[] = [
  ...TECH_CAREERS,
  ...ENGINEERING_CAREERS,
  ...OTHER_CAREERS,
];
