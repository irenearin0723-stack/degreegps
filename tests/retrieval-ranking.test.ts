// Ranking mechanics on a tiny fixed corpus, so they do not shift when data/ is re-imported.
// Retrieval quality on the real data lives in tests/retrieval.test.ts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, utimes, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { retrieveSources } from '../lib/retrieval';

const url = 'https://www.washington.edu/fixture';
const course = (course_id: string, course_name: string, description: string, skills: string) => ({ course_id, course_name, credits: 4, term: 'Winter 2027',
  offering_status: 'listed', lecture_sections: 'A', prerequisite_summary: '', category: 'fixture', description, skills, verification_notes: '', catalog_url: url, checked_at: '2026-10-17' });
const rule = (rule_id: string, program_id: string, label: string, courses: string[], notes = '') => ({ rule_id, program_id, profile_id: 'fixture', scope: 'major', label,
  logic: { type: 'all_of', courses }, source_ids: ['SRC'], verification_status: 'verified', notes, checked_at: '2026-10-17' });
const program = (program_id: string, name: string) => ({ program_id, name, degree: 'BS', profile_id: 'fixture', document_revision: null, effective_from: null,
  source_ids: ['SRC'], published_major_credit_range: null, coverage: 'Fixture program.' });
const courses = [
  course('CSE 312', 'Foundations of Computing II', 'Probability and complexity for computing.', 'probability|computational_complexity'),
  course('STAT 394', 'Probability I', 'Axiomatic probability and random variables.', 'probability'),
];
const majors = {
  institution: 'University of Washington Seattle', checked_at: '2026-10-17', course_pools: {}, optional_profiles: [], issues: [],
  source_registry: [{ source_id: 'SRC', title: 'Fixture source', url, checked_at: '2026-10-17' }],
  programs: [program('CS', 'Computer Science'), program('ECON_BS', 'Economics'), program('STAT_APP', 'Statistics: Applied Statistics'),
    program('ME', 'Mechanical Engineering'), program('ISE', 'Industrial Engineering')],
  requirements: [
    rule('CS_CORE_400', 'CS', 'Four 400-level core courses', ['CSE 401', 'CSE 421']),
    rule('ECON_CORE_400', 'ECON_BS', 'Four 400-level core courses', ['ECON 400', 'ECON 401']),
    rule('STAT_PROBABILITY', 'STAT_APP', 'Probability', ['STAT 394'], 'Probability requirement.'),
    rule('ME_STATICS', 'ME', 'Statics', ['CEE 220']),
    rule('ISE_STATICS', 'ISE', 'Statics', ['CEE 220']),
  ],
};
async function fixture(overrides: { courses?: unknown[] } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'degreegps-rank-'));
  await mkdir(join(directory, 'target_courses')); await mkdir(join(directory, 'major_requirements'));
  const files: Record<string, unknown> = {
    'target_courses/courses.json': overrides.courses ?? courses, 'target_courses/projected_offerings.json': { offerings: [] },
    'target_courses/registration_rules.json': { source_registry: [], general_policies: {}, course_concurrency_rules: {} },
    'target_courses/sections.json': [], 'target_courses/prerequisites.json': {},
    'major_requirements/major_requirements.json': majors, 'career_paths.json': { paths: [] },
  };
  for (const [path, value] of Object.entries(files)) await writeFile(join(directory, path), JSON.stringify(value));
  return directory;
}
const ranked = async (directory: string, query: string) => (await retrieveSources(query, {}, { directory, limit: 10 })).sources.map(s => s.id);

test('a named program outranks another program with identical wording, in either case', async () => {
  const directory = await fixture();
  try {
    for (const query of ['Which 400-level courses count as CS core?', 'which 400 level courses count as cs core', 'Computer Science 400-level core'])
      assert.equal((await ranked(directory, query))[0], 'requirement:CS_CORE_400', query);
    assert.equal((await ranked(directory, 'Economics 400-level core courses'))[0], 'requirement:ECON_CORE_400');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('program IDs that are ordinary words only count in capitals', async () => {
  const directory = await fixture();
  try {
    const scores = async (query: string) => Object.fromEntries((await retrieveSources(query, {}, { directory })).sources.map(s => [s.id, s.score]));
    const lower = await scores('tell me about the statics requirement');
    assert.equal(lower['requirement:ME_STATICS'], lower['requirement:ISE_STATICS']);
    assert.equal((await ranked(directory, 'ME statics requirement'))[0], 'requirement:ME_STATICS');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('course questions prefer course records; named course codes rank their own record first', async () => {
  const directory = await fixture();
  try {
    const broad = await ranked(directory, 'Which courses teach probability?');
    assert.ok(broad.indexOf('course:STAT 394') < broad.indexOf('requirement:STAT_PROBABILITY'));
    assert.equal((await ranked(directory, 'probability requirement'))[0], 'requirement:STAT_PROBABILITY');
    assert.equal((await ranked(directory, 'Does cse312 cover probability?'))[0], 'course:CSE 312');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('edited data files are picked up without restarting the server', async () => {
  const directory = await fixture();
  try {
    assert.ok(!(await ranked(directory, 'quantum')).length);
    await writeFile(join(directory, 'target_courses/courses.json'), JSON.stringify([...courses, course('CSE 490', 'Quantum Computing', 'Quantum computing basics.', 'quantum')]));
    const later = new Date(Date.now() + 5000);
    await utimes(join(directory, 'target_courses/courses.json'), later, later);
    assert.equal((await ranked(directory, 'quantum'))[0], 'course:CSE 490');
  } finally { await rm(directory, { recursive: true, force: true }); }
});
