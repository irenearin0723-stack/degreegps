import 'server-only';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CourseIdSchema, type Course } from '../types/course';
import { institutionalMajorCodes } from './registration';

export interface MajorScope {
  courses: Course[];
  // Matched requirement program IDs; empty means no profile matched and every course was kept.
  programs: string[];
  departments: string[];
}
interface Program { program_id: string; name: string }
interface MajorRequirements {
  programs: Program[];
  requirements: { program_id: string; logic: unknown }[];
  course_pools?: Record<string, { courses: string[] }>;
  optional_profiles?: { program_id: string; courses: string[] }[];
}

/** Programs for "Computer Science + Applied Mathematics": same base name or same institutional major code. */
export function matchPrograms(major: string, programs: Program[]): string[] {
  const names = major.split('+').map(m => m.trim().toLowerCase()).filter(Boolean);
  const codes = institutionalMajorCodes(major);
  return programs.filter(p => {
    const base = p.name.split(':')[0].trim();
    return names.includes(base.toLowerCase()) || [...institutionalMajorCodes(base)].some(code => codes.has(code));
  }).map(p => p.program_id);
}

/** Every course ID a requirement's logic names, including course pools, at any depth. */
function logicCourses(logic: unknown, pools: MajorRequirements['course_pools'] = {}, found = new Set<string>()): Set<string> {
  if (typeof logic === 'string') { const id = CourseIdSchema.safeParse(logic); if (id.success && /\d{3}/.test(logic)) found.add(id.data); }
  else if (Array.isArray(logic)) for (const item of logic) logicCourses(item, pools, found);
  else if (logic && typeof logic === 'object') for (const [key, value] of Object.entries(logic)) {
    if (key === 'pool_id' || key === 'pool_ids') for (const pool of [value].flat()) logicCourses(pools[String(pool)]?.courses ?? [], pools, found);
    else logicCourses(value, pools, found);
  }
  return found;
}

/**
 * Restricts planning to courses the student's program requirements name, courses in the program's home
 * department, and their catalog prerequisites (transitively). Planning a CS student no longer evaluates Mechanical Engineering or Economics courses.
 */
export async function scopeToMajor(major: string, courses: Course[], directory = join(process.cwd(), 'data')): Promise<MajorScope> {
  let data: MajorRequirements;
  try { data = JSON.parse(await readFile(join(directory, 'major_requirements/major_requirements.json'), 'utf8')); }
  catch { return { courses, programs: [], departments: [] }; }
  const programs = matchPrograms(major, data.programs ?? []);
  if (!programs.length) return { courses, programs, departments: [] };
  const relevant = new Set<string>();
  for (const rule of data.requirements ?? []) if (programs.includes(rule.program_id)) logicCourses(rule.logic, data.course_pools, relevant);
  for (const option of data.optional_profiles ?? []) if (programs.includes(option.program_id)) logicCourses(option.courses, data.course_pools, relevant);
  // Elective lists are partial (e.g. "any graded 400-level CSE major course"), so keep every catalog course in each
  // program's home department: the prefix its major-scope rules name most often.
  const departments = homeDepartments(programs, data);
  for (const c of courses) if (departments.includes(prefix(c.course_id))) relevant.add(c.course_id);
  const byId = new Map(courses.map(c => [c.course_id, c]));
  const queue = [...relevant];
  while (queue.length) {
    const course = byId.get(queue.pop()!);
    const prerequisites = [...(course?.prerequisite_alternatives ?? []).flatMap(b => b.all_of), ...(course?.prerequisite_groups ?? []).flatMap(g => g.any_of)];
    for (const { course_id } of prerequisites) if (!relevant.has(course_id)) { relevant.add(course_id); queue.push(course_id); }
  }
  return { courses: courses.filter(c => relevant.has(c.course_id)), programs, departments };
}
const prefix = (courseId: string) => courseId.replace(/ \d{3}[A-Z]?$/, '');
export function homeDepartments(programs: string[], data: Pick<MajorRequirements, 'requirements' | 'course_pools'>): string[] {
  return [...new Set(programs.flatMap(program => {
    const counts = new Map<string, number>();
    for (const rule of data.requirements ?? []) if (rule.program_id === program && (rule as { scope?: string }).scope === 'major')
      for (const id of logicCourses(rule.logic, data.course_pools)) counts.set(prefix(id), (counts.get(prefix(id)) ?? 0) + 1);
    const top = [...counts].sort((a, b) => b[1] - a[1])[0];
    return top ? [top[0]] : [];
  }))];
}
