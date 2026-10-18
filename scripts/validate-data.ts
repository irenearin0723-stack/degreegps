import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { CourseIdSchema, CourseSchema } from '../types/course';
import { ImportedCourseSchema, ImportedPrerequisiteSchema, importCourse } from '../lib/course-import';
import { ProjectionDatasetSchema, offeringForTerm } from '../lib/offerings';
import { loadData } from '../lib/data';

export async function auditData(directory = join(process.cwd(), 'data')) {
  const jsonFiles: { file: string; valid_json: boolean; error?: string }[] = [];
  async function visit(folder: string) {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const path = join(folder, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.name.endsWith('.json')) {
        try { JSON.parse(await readFile(path, 'utf8')); jsonFiles.push({ file: path.slice(directory.length + 1).replaceAll('\\', '/'), valid_json: true }); }
        catch (error) { jsonFiles.push({ file: path.slice(directory.length + 1).replaceAll('\\', '/'), valid_json: false, error: String(error) }); }
      }
    }
  }
  await visit(directory);
  const raw: unknown[] = JSON.parse(await readFile(join(directory, 'target_courses/courses.json'), 'utf8'));
  const rules: Record<string, unknown> = JSON.parse(await readFile(join(directory, 'target_courses/prerequisites.json'), 'utf8'));
  const failures: { course_id: unknown; issues: string[] }[] = [];
  const seen = new Set<string>(); const duplicates: string[] = []; const unnormalized: string[] = [];
  const rawMissing: Record<string, number> = {};
  const canonicalMissing: Record<string, number> = {};
  let directValid = 0;
  let prerequisiteValid = 0;
  let alternativeCount = 0;
  const normalizedCourses = [];
  const placeholders: string[] = [];
  for (const input of raw) {
    const row = input as Record<string, unknown>;
    const id = CourseIdSchema.safeParse(row.course_id);
    if (id.success) {
      if (id.data !== row.course_id) unnormalized.push(String(row.course_id));
      if (seen.has(id.data)) duplicates.push(id.data);
      seen.add(id.data);
    }
    if (CourseSchema.safeParse(row).success) directValid++;
    for (const key of ['title', 'prerequisite_groups', 'offered_terms', 'eligible_majors', 'source_url', 'verified_at', 'data_status', 'tracks', 'foundation_priority']) {
      if (!(key in row)) canonicalMissing[key] = (canonicalMissing[key] ?? 0) + 1;
    }
    const parsed = ImportedCourseSchema.safeParse(input);
    if (!parsed.success) for (const issue of parsed.error.issues)
      if (issue.code === 'invalid_type' && issue.message.includes('undefined')) {
        const field = issue.path.join('.'); rawMissing[field] = (rawMissing[field] ?? 0) + 1;
      }
    const rule = ImportedPrerequisiteSchema.safeParse(rules[String(row.course_id)]);
    if (rule.success) { prerequisiteValid++; alternativeCount += rule.data.any_of.length; }
    if (/\b(demo|sample|placeholder|TODO|TBD)\b/i.test(String(row.course_name))) placeholders.push(String(row.course_id));
    try { normalizedCourses.push(importCourse(input, rules[String(row.course_id)])); }
    catch (error) { failures.push({ course_id: row.course_id, issues: error instanceof z.ZodError ? error.issues.map(i => `${i.path.join('.')}: ${i.message}`) : [String(error)] }); }
  }
  const external = z.array(CourseIdSchema).parse(JSON.parse(await readFile(join(directory, 'target_courses/external_prerequisites.json'), 'utf8')).course_ids);
  const recognized = new Set([...seen, ...external]);
  const danglingPrerequisites = [...new Set(normalizedCourses.flatMap(c => c.prerequisite_alternatives?.flatMap(b => b.all_of.map(o => o.course_id)) ?? []))].filter(id => !recognized.has(id));
  const sections = JSON.parse(await readFile(join(directory, 'target_courses/sections.json'), 'utf8')) as Record<string, unknown>[];
  const slns = sections.map(s => String(s.sln));
  const major = JSON.parse(await readFile(join(directory, 'major_requirements/major_requirements.json'), 'utf8'));
  const registryIds = new Set(major.source_registry.map((s: { source_id: string }) => s.source_id));
  const danglingMajorSources = major.requirements.flatMap((r: { rule_id: string; source_ids: string[] }) => r.source_ids.filter(id => !registryIds.has(id)).map(id => `${r.rule_id}:${id}`));
  const metadata = JSON.parse(await readFile(join(directory, 'target_courses/metadata.json'), 'utf8'));
  const summary = {
    json_files: jsonFiles, total_courses: raw.length, raw_schema_valid: raw.length - failures.length,
    raw_required_fields_missing: rawMissing, direct_canonical_valid: directValid,
    direct_canonical_rejected: raw.length - directValid, canonical_fields_missing_before_adapter: canonicalMissing,
    normalized_schema_valid: normalizedCourses.length, normalized_rejected: failures.length, rejected_records: failures,
    duplicate_ids: duplicates, unnormalized_ids: unnormalized, placeholder_course_records: placeholders,
    valid_prerequisite_records: prerequisiteValid, preserved_or_branches: alternativeCount,
    external_prerequisite_ids: external.length, dangling_prerequisites: danglingPrerequisites,
    catalog_source_and_date_preserved: normalizedCourses.filter(c => c.source_url && c.verified_at).length,
    listed_winter_2027: normalizedCourses.filter(c => c.offered_term_ids?.includes('2027-winter')).length,
    not_listed_winter_2027: raw.filter(r => (r as { offering_status?: string }).offering_status === 'not_listed').map(r => (r as { course_id: string }).course_id),
    not_collected_winter_2027: raw.filter(r => (r as { offering_status?: string }).offering_status === 'not_collected').length,
    unresolved_enrollment_records: normalizedCourses.filter(c => c.enrollment_status === 'unknown').length,
    missing_section_meetings: normalizedCourses.filter(c => c.section_data_status === 'not_imported').length,
    incomplete_verification_excluded: normalizedCourses.filter(c => c.enrollment_status === 'unknown' || c.section_data_status === 'not_imported').length,
    independently_reverified_by_this_run: 0,
    sections: sections.length, duplicate_slns: slns.length - new Set(slns).size,
    orphan_sections: sections.filter(s => !seen.has(String(s.course_id))).length,
    metadata_counts_match: metadata.target_courses === raw.length && metadata.listed_courses === normalizedCourses.filter(c => c.offered_term_ids?.length).length && metadata.sections === sections.length,
    major_requirement_groups: major.requirements.length, major_acceptance_fixtures_outside_mvp: JSON.parse(await readFile(join(directory, 'major_requirements/requirements_test_cases.json'), 'utf8')).fixtures.length,
    dangling_major_source_ids: danglingMajorSources,
    notes: ['Source URLs/dates are preserved human-curated provenance; this audit does not reverify UW policy.',
      'Enrollment restrictions remain unresolved for every course; they are disclosed on planned courses, not used to block them. A Winter 2027 listing is never generalized into another term; later terms use the catalog offering pattern as tentative evidence.',
      'The planner follows the major and admission rules of the matched requirement profile; credit allocation across majors, general education and degree-wide totals are not implemented.'],
  };
  const loaded = await loadData(directory);
  const projection = ProjectionDatasetSchema.parse(JSON.parse(await readFile(join(directory, 'target_courses/projected_offerings.json'), 'utf8')));
  Object.assign(summary, { projected_source_pages: projection.sources.length, projected_source_entries: projection.offerings.length,
    effective_offerings: Object.fromEntries(['2027-winter', '2027-spring', '2027-summer'].map(term => [term, Object.fromEntries(['confirmed', 'projected', 'unknown'].map(status => [status, loaded.courses.filter(course => offeringForTerm(course, term).status === status).length]))])) });
  if (failures.length || duplicates.length || jsonFiles.some(f => !f.valid_json) || danglingPrerequisites.length || danglingMajorSources.length || !summary.metadata_counts_match || summary.duplicate_slns || summary.orphan_sections)
    throw new Error('Dataset integrity failed: ' + JSON.stringify(summary));
  return summary;
}
if (process.argv[1]?.endsWith('validate-data.ts')) {
  auditData().then(async result => {
    await writeFile('docs/reports/backend-data-audit.json', JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result, null, 2));
  }).catch(error => { console.error(String(error)); process.exitCode = 1; });
}
