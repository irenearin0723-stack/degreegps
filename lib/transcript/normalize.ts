import { CourseIdSchema } from '../../types/course';
export function normalizeCourseId(value: string): string { return CourseIdSchema.parse(value); }
