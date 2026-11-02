import type { PlanTemplate } from '@/core/planner/types';
import { fitness, habitChange } from './body';
import { jobSearch, portfolioProject } from './build';
import { examPrep, learnSkill, universityApplication } from './study';

/**
 * Built-in Goal Planner templates (SPEC 6.3: fitness/recomposition, exam prep, university
 * application (APS/Germany), learn a skill, portfolio project, job search, habit change).
 * Add a template by writing a new `PlanTemplate` and listing it here.
 */
export const PLAN_TEMPLATES: readonly PlanTemplate[] = [
  examPrep,
  universityApplication,
  portfolioProject,
  jobSearch,
  fitness,
  habitChange,
  learnSkill,
];

/** The template used when no keyword matches. */
export const DEFAULT_TEMPLATE: PlanTemplate = learnSkill;
