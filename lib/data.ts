import 'server-only';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { CourseDatasetSchema, CourseIdSchema, TrackSchema } from '../types/course';
import { mergeProjectedOfferings } from './offerings';
import { importCourse } from './course-import';
import { GoalTypeSchema } from '../types/plan';
import { importRegistration } from './registration';
export const CareerPathSchema = z.object({
  type: GoalTypeSchema, track: TrackSchema,
  skills: z.array(z.string().min(1)).min(1), projects: z.array(z.string().min(1)).min(1),
  actions: z.array(z.string().min(1)).min(1),
  data_status: z.literal('recommended'),
}).strict();
export type CareerPath = z.infer<typeof CareerPathSchema>;
export const CareerDatasetSchema = z.object({
  schema_version: z.literal('2.0.0'), paths: z.array(CareerPathSchema),
}).strict().superRefine((data, ctx) => {
  const keys = data.paths.map(p => `${p.type}:${p.track}`);
  if (new Set(keys).size !== keys.length) ctx.addIssue({ code: 'custom', message: 'Duplicate career paths' });
});
export class DataError extends Error {}
export async function loadData(directory = join(process.cwd(), 'data')) {
  try {
    const careerText = await readFile(join(directory, 'career_paths.json'), 'utf8');
    let raw: unknown;
    try { raw = JSON.parse(await readFile(join(directory, 'target_courses/courses.json'), 'utf8')); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      raw = JSON.parse(await readFile(join(directory, 'courses.json'), 'utf8'));
    }
    let courses;
    let sections: ReturnType<typeof importRegistration> = [];
    if (Array.isArray(raw)) {
      const rules = z.record(CourseIdSchema, z.unknown()).parse(JSON.parse(await readFile(join(directory, 'target_courses/prerequisites.json'), 'utf8')));
      courses = raw.map(row => importCourse(row, rules[CourseIdSchema.parse(row?.course_id)]));
      courses = mergeProjectedOfferings(courses, JSON.parse(await readFile(join(directory, 'target_courses/projected_offerings.json'), 'utf8')));
      const files = Object.fromEntries(await Promise.all(['courses.json', 'prerequisites.json', 'sections.json'].map(async name =>
        [name, await readFile(join(directory, 'target_courses', name), 'utf8')])));
      sections = importRegistration(JSON.parse(await readFile(join(directory, 'handoff/registration_evidence_handoff.json'), 'utf8')), files);
    } else {
      courses = CourseDatasetSchema.parse(raw).courses;
    }
    courses = CourseDatasetSchema.parse({ schema_version: '2.0.0', description: 'Validated course import', courses }).courses;
    return { courses, sections, careers: CareerDatasetSchema.parse(JSON.parse(careerText)).paths };
  } catch { throw new DataError('Course or career data is missing or invalid. Run npm run validate:data for record-level diagnostics.'); }
}
