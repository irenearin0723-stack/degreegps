import type { AcademicTerm, Course } from '../types/course';
import type { PlanRequest, PlanWarning, PlanSource, QuarterPlan } from '../types/plan';
import { offeringForTerm } from './offerings';
import { checkPrerequisites } from './prerequisites';
const terms: AcademicTerm[] = ['winter', 'spring', 'summer', 'autumn'];
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
export function planAcademic(request: PlanRequest, courses: Course[], now = new Date(), allowSample = false) {
  const warnings: PlanWarning[] = [];
  const warn = (code: string, message: string, ids: string[] = []) => warnings.push({ code, severity: 'warning', message, affected_course_codes: ids });
  const completed = new Set(request.completed_courses);
  const inProgress = new Set(request.in_progress_courses);
  const previous = new Set<string>();
  const sources: PlanSource[] = [];
  const reviewSeen = new Set<string>();
  const ordinal = (value: string) => Number(value.slice(0, 4)) * 4 + terms.indexOf(value.split('-')[1] as AcademicTerm);
  let start = request.start_term ?? nextTerm(now);
  if (!allowSample && ordinal(start) < ordinal(nextTerm(now))) {
    warn('START_TERM_ADJUSTED', `Requested ${start} is not a future planning quarter. Starting at ${nextTerm(now)} instead.`);
    start = nextTerm(now);
  }
  if (!request.start_term) warn('APPROXIMATE_START_TERM', `Defaulted to ${start}; confirm the desired term. Calendar windows are approximate.`);

  if (inProgress.size) warn('IN_PROGRESS_NOT_COMPLETED', 'In-progress courses are excluded from recommendations and do not satisfy prerequisites. Update completed courses after grades are confirmed.', [...inProgress]);
  if (courses.some(c => c.data_status !== 'verified')) warn('UNVERIFIED_CATALOG', 'Dataset contains sample or unknown records. Generated mode excludes these records; mock mode is illustrative and is not academic advice.');
  const incomplete = courses.filter(c => c.enrollment_status === 'unknown');
  if (incomplete.length) warn('ENROLLMENT_UNVERIFIED', `${incomplete.length} catalog records have unresolved registration eligibility. These records are excluded from confirmed course scheduling; missing restriction details are never treated as unrestricted enrollment.`);
  const snapshotTerms = [...new Set(courses.flatMap(c => c.offering_evidence?.filter(e => e.status !== 'unknown').map(e => e.term) ?? c.offered_term_ids ?? []))];
  if (snapshotTerms.length) warn('TERM_COVERAGE_LIMITED', `Positive offering evidence covers ${snapshotTerms.join(', ')} only. Confirmed listings are snapshots; departmental projections may change. No seat availability is implied.`);
  const available = courses.filter(c => c.data_status === 'verified' || (allowSample && c.data_status === 'sample'));
  // Foundation priority + track match + prerequisite unlock value. Stable ID breaks ties.
  const score = (c: Course) => c.foundation_priority * 10 + (c.tracks.includes(request.goal.track) ? 30 : 0)
    + available.filter(d => d.prerequisite_groups?.some(g => g.any_of.some(o => o.course_id === c.course_id)) || d.prerequisite_alternatives?.some(b => b.all_of.some(o => o.course_id === c.course_id))).length;
  const ranked = [...available].sort((a, b) => score(b) - score(a) || a.course_id.localeCompare(b.course_id));
  const quarters: QuarterPlan[] = [];
  const blocked = new Map<string, string>();
  for (const termId of consecutiveTerms(start)) {
    const term = termId.split('-')[1] as AcademicTerm;
    const reviews: { course: Course; status: string; sourceId: string }[] = [];
    const quarter: QuarterPlan = { term: termId, courses: [], notes: 'Eligibility depends on confirmed history, verified rules, and actual registration availability; this is not a degree audit.' };
    for (const course of ranked) {
      if (completed.has(course.course_id) || previous.has(course.course_id) || inProgress.has(course.course_id)) continue;
      if (quarter.courses.length >= request.max_courses_per_term) break;
      const sourceId = `course:${course.course_id}`;
      if (!sources.some(s => s.id === sourceId)) sources.push({ id: sourceId, title: course.title, url: course.source_url, kind: course.data_status === 'verified' ? 'official' : 'mock', verified_at: course.verified_at, data_status: course.data_status });
      if (course.schedule_source_url && !sources.some(s => s.url === course.schedule_source_url)) sources.push({ id: `schedule:${course.course_id}`, title: 'Term-specific offering snapshot (not live registration)', url: course.schedule_source_url, kind: 'official', verified_at: course.verified_at, data_status: course.data_status });
      const eligibility = checkPrerequisites(course, { completed, in_progress: inProgress, previously_planned: previous, allow_sample: allowSample });
      if (!eligibility.eligible) { blocked.set(course.course_id, `${eligibility.status === 'needs_grade_confirmation' ? 'NEEDS_GRADE_CONFIRMATION: ' : ''}${eligibility.explanations.join(' ')}`); continue; }
      const offering = offeringForTerm(course, termId);
      if (offering.status === 'unknown') { blocked.set(course.course_id, `Offering is unknown for ${termId}; no recommendation inferred.`); continue; }
      const offeringSourceId = `offering:${course.course_id}:${termId}`;
      if (!sources.some(source => source.id === offeringSourceId)) sources.push({
        id: offeringSourceId, title: `${course.course_id} ${termId}: ${offering.status} offering evidence (no seat guarantee)`,
        url: offering.source_url, kind: course.data_status === 'sample' ? 'mock' : 'official',
        verified_at: offering.verified_at, data_status: course.data_status,
      });
      const majorAllowed = course.eligible_majors?.some(m => m === '*' || m.toLowerCase() === request.major.toLowerCase());
      if (course.eligible_majors && !majorAllowed) { blocked.set(course.course_id, 'Verified major restriction does not match.'); continue; }
      if (course.enrollment_status === 'unknown' || !course.eligible_majors) {
        // Review candidates never enter quarter.courses or the previous-prerequisite set.
        if (!reviewSeen.has(course.course_id)) reviews.push({ course, status: offering.status, sourceId: offeringSourceId });
        blocked.set(course.course_id, 'Registration/major eligibility is unresolved. ' + (course.verification_notes ?? ''));
        continue;
      }
      quarter.courses.push({ id: course.course_id, title: course.title, credits: course.credits,
        scheduling_status: course.data_status === 'sample' || eligibility.conditional || offering.status === 'projected' ? 'tentative' : 'eligible',
        explanation: `${offering.status === 'projected' ? 'PROJECTED offering: tentative and subject to change; not a confirmed offering. ' : 'CONFIRMED listing snapshot, not live seats. '}Priority ${score(course)}: foundation ${course.foundation_priority}/10; ${course.tracks.includes(request.goal.track) ? 'matches' : 'supports foundations for'} ${request.goal.track} ${request.goal.type}. ${eligibility.conditional ? 'Conditional on successful completion of previously planned prerequisites. ' : ''}${allowSample ? 'Illustrative sample rules only. ' : ''}Completing a course does not guarantee skills, admission, or employment.`,
        source_ids: [sourceId, offeringSourceId] });
      if (offering.status === 'projected') warn('PROJECTED_OFFERING', `${course.course_id} in ${termId} uses a departmental projection. Recheck the Time Schedule; no confirmed offering or seat is promised.`, [course.course_id]);
      blocked.delete(course.course_id);
    }
    const reviewSelection = reviews.filter(r => !previous.has(r.course.course_id) && !quarter.courses.some(c => c.id === r.course.course_id)).slice(0, request.max_courses_per_term - quarter.courses.length);
    if (reviewSelection.length) {
      quarter.notes += ' REVIEW ONLY (not validated assignments): ' + reviewSelection.map(r => `${r.course.course_id} — ${r.course.title}; ${r.status === 'projected' ? 'projected (tentative)' : 'confirmed snapshot'} offering; enrollment eligibility unresolved`).join('; ') + '. Review candidates do not satisfy future prerequisites.';
      for (const review of reviewSelection) {
        reviewSeen.add(review.course.course_id);
        warn('COURSE_REVIEW_REQUIRED', `${termId}: ${review.course.course_id} — ${review.course.title}. Known course prerequisites are satisfied; ${review.status === 'projected' ? 'projected (tentative; subject to change)' : 'confirmed snapshot'} offering evidence is linked as ${review.sourceId}. Enrollment restrictions remain unresolved. This is an adviser-review candidate, not a validated assignment or a seat guarantee.`, [review.course.course_id]);
      }
    }
    // Same-quarter recommendations cannot satisfy one another's prerequisites.
    for (const course of quarter.courses) previous.add(course.id);
    if (quarter.courses.length < request.max_courses_per_term) warn('PARTIAL_SCHEDULE', `${termId}: only ${quarter.courses.length} courses could be suggested safely. Do not fill gaps with unverified assumptions.`);
    quarters.push(quarter);
  }
  for (const [id, reason] of blocked) {
    if (!previous.has(id)) warn(reason.startsWith('NEEDS_GRADE_CONFIRMATION:') ? 'NEEDS_GRADE_CONFIRMATION' : 'COURSE_BLOCKED', `${id}: ${reason}`, [id]);
  }
  return { quarters, warnings, sources };
}
