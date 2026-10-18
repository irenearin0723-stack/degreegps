import 'server-only';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CourseDatasetSchema } from '../types/course';
import { randomUUID } from 'node:crypto';
import { PlanRequestSchema, PlanResponseSchema, type PlanRequest } from '../types/plan';
import { loadData, CareerDatasetSchema } from './data';
import { planAcademic } from './planner';
import { planCareer } from './career';
import { deterministicSummary, explainPlan } from './ai';
export async function generatePlan(input: PlanRequest, options: { mock?: boolean; now?: Date } = {}) {
  const request = PlanRequestSchema.parse(input);
  const now = options.now ?? new Date();
  const { courses, careers, sections } = options.mock
    ? { sections: [], courses: CourseDatasetSchema.parse(JSON.parse(await readFile(join(process.cwd(), 'mocks/course-data.json'), 'utf8'))).courses,
      careers: CareerDatasetSchema.parse(JSON.parse(await readFile(join(process.cwd(), 'data/career_paths.json'), 'utf8'))).paths }
    : await loadData();
  const academic = planAcademic(request, courses, now, options.mock, sections);
  const career = planCareer(request, academic.quarters, careers, now);
  const plan = PlanResponseSchema.parse({
    schema_version: '2.0.0', plan_id: randomUUID(), mode: options.mock ? 'mock' : 'generated',
    generated_at: now.toISOString(), request, quarters: academic.quarters,
    academic_decisions: academic.academic_decisions,
    career_milestones: career.career_milestones, recommended_skills: career.recommended_skills,
    recommended_projects: career.recommended_projects,
    warnings: [...academic.warnings, ...career.warnings], sources: academic.sources,
  });
  plan.plan_summary = deterministicSummary(plan);
  if (request.use_ai_explanation && !options.mock) {
    const result = await explainPlan(plan);
    plan.plan_summary = result.summary;
    if (result.warning) plan.warnings.push({ code: 'AI_UNAVAILABLE', severity: 'info', message: result.warning, affected_course_codes: [] });
  }
  return PlanResponseSchema.parse(plan);
}
