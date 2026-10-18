import 'server-only';
import type { PlanResponse } from '../types/plan';
import type { AcademicDecision } from '../types/registration';
import type { CorpusChunk } from './rag-corpus';

// Per-course warnings are already described by the course chunks; keep plan-wide notices in the overview.
const PER_COURSE_WARNINGS = new Set(['COURSE_BLOCKED', 'NEEDS_GRADE_CONFIRMATION', 'COURSE_REVIEW_REQUIRED', 'PROJECTED_OFFERING', 'PARTIAL_SCHEDULE']);

const chunk = (id: string, document_title: string, content: string, course_ids: string[], verified_at: string): CorpusChunk => ({
  id, kind: 'plan', document_title, content, source_url: null, section: 'Your DegreeGPS plan', verified_at, effective_date: null,
  official: false, program_id: null, program_name: null, course_ids,
});

/** The planner's first failing check for a course in one term, in the order the planner applies them. */
export function blockingReason(d: AcademicDecision): string | null {
  if (d.catalog_prerequisite_status === 'needs_grade_confirmation') return 'a prerequisite grade must be confirmed (no reviewed grade was provided)';
  if (d.catalog_prerequisite_status !== 'met') return 'prerequisites are not met yet';
  if (d.term_offering_status === 'unknown') return 'there is no offering evidence for this term';
  if (d.section_registration_status === 'ineligible') return 'a known registration restriction does not match your major or selected sections';
  if (d.section_registration_status === 'unknown') return 'registration eligibility is unresolved, so it is an adviser-review candidate only';
  return null;
}

/**
 * Citable sources describing one student's generated plan: inputs and notices, each quarter, and every course the
 * planner evaluated. Built server-side from a deterministic plan; never includes reviewed grade values.
 */
export function planChunks(plan: PlanResponse, titles: ReadonlyMap<string, string> = new Map()): CorpusChunk[] {
  const date = plan.generated_at.slice(0, 10);
  const { request } = plan;
  const terms = plan.quarters.map(q => q.term);
  const scheduled = new Map(plan.quarters.flatMap(q => q.courses.map(c => [c.id, { term: q.term, course: c }] as const)));
  const notices = plan.warnings.filter(w => !PER_COURSE_WARNINGS.has(w.code)).map(w => `${w.code}: ${w.message}`);
  const chunks = [chunk('plan:overview', 'Your plan: inputs and notices',
    `Your DegreeGPS plan for ${request.major}, goal ${request.goal.type} (${request.goal.track})${request.goal.deadline ? ` by ${request.goal.deadline}` : ', flexible deadline'}. ` +
    `Quarters planned: ${terms.join(', ')}; up to ${request.max_courses_per_term} courses per quarter. ` +
    `Completed courses: ${request.completed_courses.join(', ') || 'none entered'}. In progress: ${request.in_progress_courses.join(', ') || 'none'}. ` +
    `Scheduled courses: ${[...scheduled.keys()].join(', ') || 'none could be scheduled safely'}. ${notices.join(' ')}`, [...scheduled.keys()], date)];

  plan.quarters.forEach((q, i) => chunks.push(chunk(`plan:quarter:${q.term}`, `Your plan: ${q.term} quarter`,
    `Your plan for the ${q.term} quarter (quarter ${i + 1} of ${terms.length}${i === 0 ? ', the next quarter' : ''}): ` +
    `${q.courses.length ? `scheduled ${q.courses.map(c => `${c.id} ${c.title} (${c.scheduling_status})`).join(', ')}` : 'no courses could be scheduled safely'}. ${q.notes}`,
    q.courses.map(c => c.id), date)));

  const decisions = new Map<string, AcademicDecision[]>();
  for (const d of plan.academic_decisions ?? []) decisions.set(d.course_id, [...(decisions.get(d.course_id) ?? []), d]);
  for (const [id, list] of decisions) {
    const title = titles.get(id) ?? id;
    const placed = scheduled.get(id);
    const byTerm = terms.map(term => {
      const d = list.find(x => x.term === term);
      if (!d) return `${term}: not evaluated (already planned earlier, or the quarter reached your course limit)`;
      if (placed?.term === term) return `${term}: scheduled (${placed.course.scheduling_status})`;
      return `${term}: not scheduled because ${blockingReason(d) ?? 'the quarter reached your course limit'}; offering ${d.term_offering_status}, registration ${d.section_registration_status}`;
    });
    const reasons = [...new Set(list.flatMap(d => d.prerequisite_reasons))];
    chunks.push(chunk(`plan:course:${id}`, `Your plan: ${title}`,
      `${title} in your DegreeGPS plan: ${placed ? `scheduled in ${placed.term}` : `not scheduled in ${terms.join(', ')}`}. ${byTerm.join('. ')}.` +
      `${reasons.length ? ` Prerequisite check: ${reasons.join(' ')}` : ''}`, [id], date));
  }
  return chunks;
}
