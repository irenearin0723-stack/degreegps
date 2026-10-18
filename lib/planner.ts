import type { AcademicTerm, Course } from '../types/course';
import type { PlanRequest, PlanWarning, PlanSource, QuarterPlan } from '../types/plan';
import { offeringForTerm } from './offerings';
import { checkPrerequisites } from './prerequisites';
import { evaluateRegistration, majorLabels } from './registration';
import { IMPORTANCE_LABELS } from './major-scope';
import type { AcademicDecision, RegistrationSection } from '../types/registration';
const terms: AcademicTerm[] = ['winter', 'spring', 'summer', 'autumn'];
// Per-course blocked warnings beyond this are folded into one COURSE_BLOCKED_SUMMARY; academic_decisions keeps every reason.
export const BLOCKED_DETAIL_LIMIT = 10;
type BlockedKind = 'prerequisites' | 'grade' | 'offering' | 'registration';
// MVP calendar windows, not official UW registration/start dates.
export function nextTerm(now: Date): string {
  const month = now.getUTCMonth();
  const year = now.getUTCFullYear();
  if (month < 3) return `${year}-spring`;
  if (month < 6) return `${year}-summer`;
  if (month < 9) return `${year}-autumn`;
  return `${year + 1}-winter`;
}
export function consecutiveTerms(start: string): string[] {
  const [yearText, termText] = start.split('-');
  const initial = Number(yearText) * 4 + terms.indexOf(termText as AcademicTerm);
  return Array.from({ length: 3 }, (_, i) => `${Math.floor((initial + i) / 4)}-${terms[(initial + i) % 4]}`);
}
/** importance: how strongly the student's major needs each course (3 required, 2 named option, 1 elective pool); see major-scope.ts. */
export function planAcademic(request: PlanRequest, courses: Course[], now = new Date(), allowSample = false, sections: RegistrationSection[] = [],
  importance: Record<string, number> = {}) {
  const warnings: PlanWarning[] = [];
  const warn = (code: string, message: string, ids: string[] = []) => warnings.push({ code, severity: 'warning', message, affected_course_codes: ids });
  const completed = new Set(request.completed_courses);
  const inProgress = new Set(request.in_progress_courses);
  const previous = new Set<string>();
  const sources: PlanSource[] = [];
  const academic_decisions: AcademicDecision[] = [];
  const ordinal = (value: string) => Number(value.slice(0, 4)) * 4 + terms.indexOf(value.split('-')[1] as AcademicTerm);
  let start = request.start_term ?? nextTerm(now);
  if (!allowSample && ordinal(start) < ordinal(nextTerm(now))) {
    warn('START_TERM_ADJUSTED', `Requested ${start} is not a future planning quarter. Starting at ${nextTerm(now)} instead.`);
    start = nextTerm(now);
  }
  if (!request.start_term) warn('APPROXIMATE_START_TERM', `Defaulted to ${start}; confirm the desired term. Calendar windows are approximate.`);

  for (const [term, slns] of Object.entries(request.selected_slns ?? {})) {
    if (slns.some(sln => !sections.some(s => s.sln === sln && s.term_id === term)))
      warn('SECTION_SELECTION_UNKNOWN', `${term}: selected SLN has no imported evidence for that exact term. No registration clearance inferred.`);
  }
  if (inProgress.size) warn('IN_PROGRESS_NOT_COMPLETED', 'In-progress courses are not completed. Only explicit exact-term concurrent intentions can satisfy a specifically verified concurrency exception. Update completed courses after grades are confirmed.', [...inProgress]);
  if (courses.some(c => c.data_status !== 'verified')) warn('UNVERIFIED_CATALOG', 'Dataset contains sample or unknown records. Generated mode excludes these records; mock mode is illustrative and is not academic advice.');
  const incomplete = courses.filter(c => c.enrollment_status === 'unknown');
  if (incomplete.length) warn('ENROLLMENT_UNVERIFIED', `${incomplete.length} catalog records have unresolved registration eligibility. They are still scheduled when prerequisites and offerings allow; each course explains its registration status, and restrictions must be confirmed before registering.`);
  const snapshotTerms = [...new Set(courses.flatMap(c => c.offering_evidence?.filter(e => e.status !== 'unknown').map(e => e.term) ?? c.offered_term_ids ?? []))];
  if (snapshotTerms.length) warn('TERM_COVERAGE_LIMITED', `Positive offering evidence covers ${snapshotTerms.join(', ')} only. Confirmed listings are snapshots; departmental projections may change. No seat availability is implied.`);
  const available = courses.filter(c => c.data_status === 'verified' || (allowSample && c.data_status === 'sample'));
  // Importance to the major first, then foundation priority + track match + prerequisite unlock value. Stable ID breaks ties.
  const score = (c: Course) => (importance[c.course_id] ?? 0) * 100 + c.foundation_priority * 10 + (c.tracks.includes(request.goal.track) ? 30 : 0)
    + available.filter(d => d.prerequisite_groups?.some(g => g.any_of.some(o => o.course_id === c.course_id)) || d.prerequisite_alternatives?.some(b => b.all_of.some(o => o.course_id === c.course_id))).length;
  const ranked = [...available].sort((a, b) => score(b) - score(a) || a.course_id.localeCompare(b.course_id));
  // A completed course implies its prerequisite chain (MATH 126 done means MATH 124/125 need not be planned).
  const byId = new Map(courses.map(c => [c.course_id, c]));
  const implied = new Set<string>();
  const queue = [...completed, ...inProgress];
  while (queue.length) {
    const course = byId.get(queue.pop()!);
    for (const id of [...(course?.prerequisite_alternatives ?? []).flatMap(b => b.all_of.map(o => o.course_id)),
      ...(course?.prerequisite_groups ?? []).flatMap(g => g.any_of.map(o => o.course_id))])
      if (!implied.has(id)) { implied.add(id); queue.push(id); }
  }
  const quarters: QuarterPlan[] = [];
  const blocked = new Map<string, { reason: string; kind: BlockedKind }>();
  for (const termId of consecutiveTerms(start)) {
    const invalidSelection = (request.selected_slns?.[termId] ?? []).some(sln => !sections.some(s => s.sln === sln && s.term_id === termId));
    const concurrent = new Set(request.concurrent_courses?.[termId] ?? []);
    if (concurrent.size) warn('CONCURRENT_INTENTIONS', `${termId}: concurrent intentions are conditional, not completed courses or validated external assignments. Verify actual concurrent enrollment.`, [...concurrent]);
    const quarter: QuarterPlan = { term: termId, courses: [], notes: 'Eligibility depends on confirmed history, verified rules, and actual registration availability; this is not a degree audit.' };
    for (const course of ranked) {
      if (completed.has(course.course_id) || previous.has(course.course_id) || inProgress.has(course.course_id) || implied.has(course.course_id)) continue;
      if (quarter.courses.length >= request.max_courses_per_term) break;
      const sourceId = `course:${course.course_id}`;
      if (!sources.some(s => s.id === sourceId)) sources.push({ id: sourceId, title: course.title, url: course.source_url, kind: course.data_status === 'verified' ? 'official' : 'mock', verified_at: course.verified_at, data_status: course.data_status });
      if (course.schedule_source_url && !sources.some(s => s.url === course.schedule_source_url)) sources.push({ id: `schedule:${course.course_id}`, title: 'Term-specific offering snapshot (not live registration)', url: course.schedule_source_url, kind: 'official', verified_at: course.verified_at, data_status: course.data_status });
      const eligibility = checkPrerequisites(course, { completed, in_progress: inProgress, previously_planned: previous,
        concurrent, grades: request.reviewed_grades, allow_sample: allowSample });
      const offering = offeringForTerm(course, termId);
      const sectionEvidence = sections.filter(s => s.course_id === course.course_id && s.term_id === termId);
      for (const section of sectionEvidence) {
        for (const [prefix, url] of [['section', section.source_url], ['section-detail', section.detail_url]]) {
          const id = `${prefix}:${termId}:${section.sln}`;
          if (!sources.some(source => source.id === id)) sources.push({ id, title: `${course.course_id} section ${section.section} SLN ${section.sln}: curated evidence, not complete clearance or live seats`,
            url, kind: 'official', verified_at: section.snapshot_at.slice(0, 10), data_status: 'verified' });
        }
      }
      const majorAllowed = course.eligible_majors?.some(m => m === '*' || m.toLowerCase() === request.major.toLowerCase()
        || (majorLabels(m).size > 0 && [...majorLabels(m)].some(label => majorLabels(request.major).has(label))));
      const registration = evaluateRegistration(sections, course.course_id, termId, request.major, concurrent, request.selected_slns?.[termId], now.toISOString().slice(0, 10));
      const registrationStatus = invalidSelection ? 'unknown' : sectionEvidence.length ? registration.status
        : course.eligible_majors && !majorAllowed ? 'ineligible'
        : course.enrollment_status === 'unknown' || !course.eligible_majors ? 'unknown' : 'eligible';
      const offeringSourceId = `offering:${course.course_id}:${termId}`;
      if (offering.status !== 'unknown' && !sources.some(source => source.id === offeringSourceId)) sources.push({
        id: offeringSourceId, title: `${course.course_id} ${termId}: ${offering.status} offering evidence (no seat guarantee)`,
        url: offering.source_url, kind: course.data_status === 'sample' ? 'mock' : 'official',
        verified_at: offering.verified_at, data_status: course.data_status,
      });
      academic_decisions.push({ course_id: course.course_id, term: termId,
        catalog_prerequisite_status: eligibility.status, prerequisite_conditional: eligibility.conditional, prerequisite_reasons: eligibility.explanations,
        section_registration_status: registrationStatus, term_offering_status: offering.status,
        schedule_conflict_status: 'not_evaluated', schedule_conflict_reason: 'Quarter-level planning only; no section timetable or conflict-free registration claim. Meeting times do not block quarter-level planning.',
        sections: registration.sections, source_ids: [sourceId, ...(offering.status === 'unknown' ? [] : [offeringSourceId])] });
      if (!eligibility.eligible) { blocked.set(course.course_id, eligibility.status === 'needs_grade_confirmation'
        ? { reason: eligibility.explanations.join(' '), kind: 'grade' } : { reason: eligibility.explanations.join(' '), kind: 'prerequisites' }); continue; }
      if (offering.status === 'unknown') { blocked.set(course.course_id, { reason: `Offering is unknown for ${termId}; no recommendation inferred.`, kind: 'offering' }); continue; }
      // Registration eligibility does not block planning; it is reported on the course so the student can confirm it.
      const registrationNote = registrationStatus === 'ineligible' ? 'A recorded section restriction does not match your major or selected section; confirm with an adviser before registering. '
        : registrationStatus === 'unknown' ? 'Registration restrictions are not verified; check the Time Schedule and confirm before registering. ' : '';
      const need = importance[course.course_id] ? `Planned because it is ${IMPORTANCE_LABELS[importance[course.course_id]]}. ` : '';
      quarter.courses.push({ id: course.course_id, title: course.title, credits: course.credits,
        scheduling_status: course.data_status === 'sample' || eligibility.conditional || offering.status === 'projected' ? 'tentative' : 'eligible',
        explanation: `${need}${offering.status === 'projected' ? 'PROJECTED offering: tentative and subject to change; not a confirmed offering. ' : 'CONFIRMED listing snapshot, not live seats. '}Priority ${score(course)}: foundation ${course.foundation_priority}/10; ${course.tracks.includes(request.goal.track) ? 'matches' : 'supports foundations for'} ${request.goal.track} ${request.goal.type}. ${eligibility.conditional ? 'Conditional on successful completion of previously planned prerequisites. ' : ''}${allowSample ? 'Illustrative sample rules only. ' : ''}${registrationNote}Completing a course does not guarantee skills, admission, or employment.`,
        source_ids: [sourceId, offeringSourceId] });
      if (offering.status === 'projected') warn('PROJECTED_OFFERING', `${course.course_id} in ${termId} uses a departmental projection. Recheck the Time Schedule; no confirmed offering or seat is promised.`, [course.course_id]);
      blocked.delete(course.course_id);
    }
    // Same-quarter recommendations cannot satisfy one another's prerequisites.
    for (const course of quarter.courses) previous.add(course.id);
    if (quarter.courses.length < request.max_courses_per_term) warn('PARTIAL_SCHEDULE', `${termId}: only ${quarter.courses.length} courses had completed prerequisites and an offering this quarter.`);
    quarters.push(quarter);
  }
  // Detail the courses closest to schedulable first (prerequisites met or only a grade missing), in priority order.
  const rank = new Map(ranked.map((c, i) => [c.course_id, i]));
  const pending = [...blocked].filter(([id]) => !previous.has(id))
    .sort(([a, x], [b, y]) => Number(x.kind === 'prerequisites') - Number(y.kind === 'prerequisites') || rank.get(a)! - rank.get(b)!);
  for (const [id, { reason, kind }] of pending.slice(0, BLOCKED_DETAIL_LIMIT))
    warn(kind === 'grade' ? 'NEEDS_GRADE_CONFIRMATION' : 'COURSE_BLOCKED', `${id}: ${kind === 'grade' ? 'NEEDS_GRADE_CONFIRMATION: ' : ''}${reason}`, [id]);
  const rest = pending.slice(BLOCKED_DETAIL_LIMIT);
  if (rest.length) {
    const count = (kind: BlockedKind) => rest.filter(([, b]) => b.kind === kind).length;
    const parts = [[count('prerequisites'), 'need', 'needs', 'prerequisites not yet completed'], [count('offering'), 'have', 'has', 'no offering evidence for these terms'],
      [count('registration'), 'have', 'has', 'unresolved or non-matching registration restrictions'], [count('grade'), 'need', 'needs', 'a reviewed prerequisite grade']] as const;
    warnings.push({ code: 'COURSE_BLOCKED_SUMMARY', severity: 'info', affected_course_codes: rest.map(([id]) => id),
      message: `${rest.length} more course${rest.length === 1 ? ' was' : 's were'} not scheduled: ${parts.filter(([n]) => n).map(([n, plural, singular, text]) => `${n} ${n === 1 ? singular : plural} ${text}`).join('; ')}. Per-course reasons are in academic_decisions.` });
  }
  return { quarters, warnings, sources, academic_decisions };
}
