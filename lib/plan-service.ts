import 'server-only';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CourseDatasetSchema } from '../types/course';
import { randomUUID } from 'node:crypto';
import { PlanRequestSchema, PlanResponseSchema, type PlanRequest, type PlanResponse } from '../types/plan';
import { loadData, CareerDatasetSchema } from './data';
import { planAcademic } from './planner';
import { planCareer } from './career';
import { deterministicSummary, explainPlan } from './ai';
import { retrieveSources, type RetrievedSource } from './retrieval';
import { scopeToMajor } from './major-scope';

const POLICY_KINDS = new Set(['requirement', 'program', 'policy_issue', 'registration_policy', 'program_option']);
/** Official requirement/policy records related to the plan's major, goal and courses (local keyword retrieval only). */
async function planPolicies(plan: PlanResponse): Promise<RetrievedSource[]> {
  const courses = plan.quarters.flatMap(q => q.courses.map(c => c.id));
  const query = `${plan.request.major} ${plan.request.goal.track} ${plan.request.goal.type} requirements ${courses.join(' ')}`;
  try {
    const { sources } = await retrieveSources(query, { official_only: true }, { limit: 10, boost_course_ids: courses });
    return sources.filter(s => POLICY_KINDS.has(s.kind)).slice(0, 3);
  } catch { return []; }
}
export async function generatePlan(input: PlanRequest, options: { mock?: boolean; now?: Date; aiBlocked?: string } = {}) {
  const request = PlanRequestSchema.parse(input);
  const now = options.now ?? new Date();
  const { courses, careers, sections } = options.mock
    ? { sections: [], courses: CourseDatasetSchema.parse(JSON.parse(await readFile(join(process.cwd(), 'mocks/course-data.json'), 'utf8'))).courses,
      careers: CareerDatasetSchema.parse(JSON.parse(await readFile(join(process.cwd(), 'data/career_paths.json'), 'utf8'))).paths }
    : await loadData();
  const scope = options.mock ? { courses, programs: [], departments: [], importance: {} } : await scopeToMajor(request.major, courses);
  const academic = planAcademic(request, scope.courses, now, options.mock, sections, scope.importance);
  if (!options.mock) academic.warnings.unshift(scope.programs.length
    ? { code: 'MAJOR_SCOPE', severity: 'info', affected_course_codes: [],
      message: `Planning considered ${scope.courses.length} of ${courses.length} catalog courses: those named by ${request.major} requirements (${scope.programs.join(', ')}), other ${scope.departments.join('/')} courses, and their prerequisites.` }
    : { code: 'MAJOR_SCOPE_UNAVAILABLE', severity: 'warning', affected_course_codes: [],
      message: `No requirement profile matches "${request.major}", so all ${courses.length} catalog courses were considered.` });
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
  if (request.use_ai_explanation && !options.mock && options.aiBlocked)
    plan.warnings.push({ code: 'AI_RATE_LIMITED', severity: 'info', message: options.aiBlocked.replace(/^AI_RATE_LIMITED: /, ''), affected_course_codes: [] });
  else if (request.use_ai_explanation && !options.mock) {
    const policies = await planPolicies(plan);
    const result = await explainPlan(plan, policies);
    plan.plan_summary = result.summary;
    for (const source of policies.filter(p => result.cited.includes(p.id)))
      plan.sources.push({ id: `retrieved:${source.id}`, title: source.document_title, url: source.source_url, kind: 'official',
        verified_at: source.verified_at, data_status: /Verification: verified\./.test(source.content) ? 'verified' : 'unknown' });
    if (result.warning) plan.warnings.push({ code: 'AI_UNAVAILABLE', severity: 'info', message: result.warning, affected_course_codes: [] });
  }
  return PlanResponseSchema.parse(plan);
}
