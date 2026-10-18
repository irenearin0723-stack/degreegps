import test from 'node:test';
import assert from 'node:assert/strict';
import { uniqueCourseIds, mergeCourseHistory } from '../lib/course-history';
import { toBackendRequest } from '../lib/plan-api';

test('course identity removes duplicates across casing and spacing before submission', () => {
  assert.deepEqual(uniqueCourseIds(['MATH124', ' math 124 ', 'MATH   124', 'CSE123']), ['MATH 124', 'CSE 123']);
});
test('PDF import merges existing manual history without duplicates or dropping other courses', () => {
  assert.deepEqual(mergeCourseHistory({ completed_courses: ['math124', 'CSE 123'], in_progress_courses: ['MATH 125'] }, ['MATH 124', 'MATH126'], ['math 125']), {
    completed_courses: ['MATH 124', 'CSE 123', 'MATH 126'], in_progress_courses: ['MATH 125'],
  });
});
test('PDF/manual completion-status conflicts require review instead of inferring completion', () => {
  assert.throws(() => mergeCourseHistory({completed_courses: ['MATH124'], in_progress_courses: []}, [], ['math 124']), /cannot be both completed and in progress/);
});
test('restored duplicate history is normalized before a real API request and grades remain attached', () => {
  const request = toBackendRequest({majors:['Computer Science'],completed_courses:['math124','MATH 124'],in_progress_courses:['CSE123','CSE 123'],reviewed_grades:{'math124':3.5},target_role:'ML Intern',target_summer:2027,max_courses_per_term:3,start_term:'winter',start_year:2027,horizon_terms:3});
  assert.deepEqual(request.completed_courses,['MATH 124']); assert.deepEqual(request.in_progress_courses,['CSE 123']); assert.deepEqual(request.reviewed_grades,{'MATH 124':3.5});
});
