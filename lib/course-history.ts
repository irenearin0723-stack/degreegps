import { CourseIdSchema } from '../types/course';

/** One canonical identity for manual entries, reviewed PDF rows and restored plans. */
export function canonicalCourseId(value: string): string {
  const parsed = CourseIdSchema.safeParse(value);
  return parsed.success ? parsed.data : value.trim().toUpperCase();
}
export function uniqueCourseIds(values: string[]): string[] {
  return [...new Set(values.map(canonicalCourseId))];
}
export function mergeCourseHistory(existing: { completed_courses: string[]; in_progress_courses: string[] }, completed: string[], inProgress: string[]) {
  const completed_courses = uniqueCourseIds([...existing.completed_courses, ...completed]);
  const in_progress_courses = uniqueCourseIds([...existing.in_progress_courses, ...inProgress]);
  const conflicts = completed_courses.filter(id => in_progress_courses.includes(id));
  if (conflicts.length) throw new Error(`${conflicts.join(', ')} cannot be both completed and in progress. Remove the conflicting entry or correct its reviewed status before importing.`);
  return { completed_courses, in_progress_courses };
}
