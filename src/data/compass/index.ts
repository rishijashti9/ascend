import { CAREERS } from './careers';
import { GUIDELINES, HELPLINES } from './health';
import { ROADMAPS } from './roadmaps';
import type { PackInput } from './schema';
import { SKILLS } from './skills';
import { SOURCES } from './sources';

/**
 * The Growth Compass knowledge pack (SPEC 6.7 B). Bump `version` (YYYY.MM.n) whenever any
 * data file changes, so it's clear which knowledge a recommendation came from.
 */
export const PACK_INPUT: PackInput = {
  version: '2026.11.1',
  sources: SOURCES,
  careers: CAREERS,
  skills: SKILLS,
  roadmaps: ROADMAPS,
  guidelines: GUIDELINES,
  helplines: HELPLINES,
};

export { ONET_ATTRIBUTION } from './sources';
