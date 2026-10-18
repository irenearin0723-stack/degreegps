import type { Course } from '../types/course';
import { CourseIdSchema } from '../types/course';
export interface PrerequisiteContext {
  completed: ReadonlySet<string>;
  in_progress?: ReadonlySet<string>;
  previously_planned?: ReadonlySet<string>;
  concurrent?: ReadonlySet<string>;
  grades?: Readonly<Record<string, number>>;
  allow_sample?: boolean;
}
export interface PrerequisiteResult {
  eligible: boolean; conditional: boolean; missing_groups: string[][]; explanations: string[];
  status: 'met' | 'unmet' | 'unknown' | 'needs_grade_confirmation';
}
const normalized = (set?: ReadonlySet<string>) => new Set([...set ?? []].map(id => CourseIdSchema.parse(id)));
export function checkPrerequisites(course: Course, context: PrerequisiteContext): PrerequisiteResult {
  const completed = normalized(context.completed);
  const previous = normalized(context.previously_planned);
  const progress = normalized(context.in_progress);
  const concurrent = normalized(context.concurrent);
  const grades = Object.fromEntries(Object.entries(context.grades ?? {}).map(([id, grade]) => [CourseIdSchema.parse(id), grade]));
  const result = (status: PrerequisiteResult['status'], explanations: string[], missing_groups: string[][] = [], conditional = false): PrerequisiteResult =>
    ({ eligible: status === 'met', conditional, explanations, missing_groups, status });
  if (completed.has(course.course_id) || previous.has(course.course_id) || progress.has(course.course_id))
    return result('unmet', ['Course is already completed, in progress, or previously planned.']);
  if (course.data_status !== 'verified' && !(context.allow_sample && course.data_status === 'sample'))
    return result('unknown', ['Prerequisite information is unverified.']);
  if (course.prerequisite_groups === null && !course.prerequisite_alternatives)
    return result('unknown', ['Prerequisites are unknown.']);
  type Option = NonNullable<Course['prerequisite_groups']>[number]['any_of'][number];
  const evaluate = (option: Option) => {
    const done = completed.has(option.course_id);
    const planned = previous.has(option.course_id);
    const parallel = option.concurrent_allowed && course.data_status === 'verified' && concurrent.has(option.course_id);
    const hasCourse = done || planned || parallel;
    const missingGrade = option.minimum_grade !== null && hasCourse && (!done || grades[option.course_id] === undefined);
    const gradeOkay = option.minimum_grade === null || (done && Number.isFinite(grades[option.course_id]) && grades[option.course_id] >= option.minimum_grade);
    return { met: hasCourse && gradeOkay, missingGrade, canMeet: hasCourse && (gradeOkay || missingGrade), conditional: !done };
  };
  const describe = (option: Option) => option.course_id + (option.minimum_grade === null ? '' : ` (grade >= ${option.minimum_grade})`) + (option.concurrent_allowed ? ' (verified concurrency permitted)' : '');
  if (course.prerequisite_alternatives) {
    const branches = course.prerequisite_alternatives.map(branch => ({
      options: branch.all_of, evaluations: branch.all_of.map(evaluate),
    }));
    const satisfied = branches.find(b => b.evaluations.every(e => e.met && !e.conditional))
      ?? branches.find(b => b.evaluations.every(e => e.met));
    if (satisfied) return result('met', [], [], satisfied.evaluations.some(e => e.conditional));
    const missingGrade = branches.some(b => b.evaluations.every(e => e.canMeet) && b.evaluations.some(e => e.missingGrade));
    return result(missingGrade ? 'needs_grade_confirmation' : 'unmet', [
      `${missingGrade ? 'Confirm actual qualifying grades. ' : ''}Requires one complete alternative: ${branches.map(b => '(' + b.options.map(describe).join(' AND ') + ')').join(' OR ')}. In-progress courses do not count as completed.`,
    ], branches.map(b => b.options.filter((_, i) => !b.evaluations[i].met).map(o => o.course_id)));
  }
  let conditional = false;
  let needsGrade = false;
  let impossible = false;
  const missing: string[][] = [];
  const reasons: string[] = [];
  for (const group of course.prerequisite_groups ?? []) {
    const evaluations = group.any_of.map(evaluate);
    const satisfied = evaluations.find(e => e.met && !e.conditional) ?? evaluations.find(e => e.met);
    if (satisfied) conditional ||= satisfied.conditional;
    else {
      const gradePotential = evaluations.some(e => e.canMeet && e.missingGrade);
      needsGrade ||= gradePotential;
      impossible ||= !gradePotential;
      missing.push(group.any_of.map(o => o.course_id));
      reasons.push(`Requires ${group.any_of.map(describe).join(' OR ')} before enrollment, unless verified concurrent enrollment is allowed.`);
    }
  }
  return result(reasons.length === 0 ? 'met' : needsGrade && !impossible ? 'needs_grade_confirmation' : 'unmet', reasons, missing, conditional);
}
