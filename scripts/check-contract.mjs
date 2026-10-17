import fs from 'node:fs';
import assert from 'node:assert/strict';

const data = JSON.parse(fs.readFileSync(new URL('../mocks/sample-plan.json', import.meta.url), 'utf8'));
const exampleRequest = JSON.parse(fs.readFileSync(new URL('../examples/sample-request.json', import.meta.url), 'utf8'));
assert.deepEqual(exampleRequest, data.request, 'example request must equal the canonical fixture request');
const terms = ['winter', 'spring', 'summer', 'autumn'];
const isObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const string = (x) => typeof x === 'string' && x.length > 0;
const arr = (x) => Array.isArray(x);
const int = (x) => Number.isInteger(x);
const hasKeys = (obj, keys, where) => {
  assert.ok(isObject(obj), `${where} must be an object`);
  assert.deepEqual(Object.keys(obj).sort(), [...keys].sort(), `${where}: unexpected or missing keys`);
};

hasKeys(data, ['schema_version', 'plan_id', 'mode', 'generated_at', 'request', 'quarters', 'career_milestones', 'warnings', 'sources'], 'PlanResponse');
assert.equal(data.schema_version, '1.0.0');
assert.ok(string(data.plan_id) && ['mock','generated'].includes(data.mode));
assert.ok(!Number.isNaN(Date.parse(data.generated_at)), 'invalid generated_at');

const r = data.request;
hasKeys(r, ['majors','completed_courses','in_progress_courses','target_role','target_summer','max_courses_per_term','start_term','start_year','horizon_terms'], 'PlanRequest');
assert.ok(arr(r.majors) && r.majors.length && r.majors.every(string));
assert.ok(arr(r.completed_courses) && r.completed_courses.every(string));
assert.ok(arr(r.in_progress_courses) && r.in_progress_courses.every(string));
assert.ok(string(r.target_role) && int(r.target_summer) && r.target_summer >= 2000 && r.target_summer <= 2100);
assert.ok(int(r.max_courses_per_term) && r.max_courses_per_term >= 1 && r.max_courses_per_term <= 5);
assert.ok(terms.includes(r.start_term) && int(r.start_year) && r.start_year >= 2000 && r.start_year <= 2100);
assert.ok(int(r.horizon_terms) && r.horizon_terms >= 1 && r.horizon_terms <= 8);
assert.equal(new Set([...r.completed_courses, ...r.in_progress_courses]).size, r.completed_courses.length + r.in_progress_courses.length, 'duplicate or conflicting input courses');

assert.ok(arr(data.sources) && arr(data.quarters) && arr(data.career_milestones) && arr(data.warnings));
assert.ok(data.mode === 'mock' || data.mode === 'generated');
if (data.mode === 'mock') assert.ok(data.warnings.some((x) => x.code === 'UNVERIFIED_CATALOG'), 'mock must warn about unverified catalog');
const sourceIds = new Set();
for (const s of data.sources) {
  hasKeys(s, ['id','title','url','kind','retrieved_at'], 'PlanSource');
  assert.ok(string(s.id) && string(s.title));
  assert.ok(s.url === null || /^https?:\/\//.test(s.url), 'source URLs must be http(s) or null');
  assert.ok(['official','third_party','mock'].includes(s.kind));
  assert.ok(s.retrieved_at === null || !Number.isNaN(Date.parse(s.retrieved_at)));
  assert.ok(!sourceIds.has(s.id), 'duplicate source id');
  sourceIds.add(s.id);
}

assert.equal(data.quarters.length, r.horizon_terms, 'expected one quarter per horizon term');
const quarterIds = new Set();
const codes = new Set();
const ordinal = (year, term) => year * 4 + terms.indexOf(term);
let previous = null;
for (const q of data.quarters) {
  hasKeys(q, ['id','year','term','courses','notes'], 'QuarterPlan');
  assert.ok(int(q.year) && terms.includes(q.term));
  assert.equal(q.id, `${q.year}-${q.term}`);
  assert.ok(arr(q.courses) && typeof q.notes === 'string');
  assert.ok(q.courses.length <= r.max_courses_per_term, 'workload exceeds max courses');
  assert.ok(!quarterIds.has(q.id), 'duplicate quarter id');
  quarterIds.add(q.id);
  const order = ordinal(q.year,q.term);
  if (previous !== null) assert.equal(order, previous + 1, 'quarters must be consecutive');
  previous = order;
  for (const c of q.courses) {
    hasKeys(c, ['code','title','credits','category','status','rationale','source_ids'], 'PlannedCourse');
    assert.ok(string(c.code) && string(c.title) && typeof c.rationale === 'string');
    assert.ok(c.credits === null || (int(c.credits) && c.credits > 0));
    assert.ok(['major','math','elective','general_education','other'].includes(c.category));
    assert.ok(['planned','in_progress'].includes(c.status));
    assert.ok(arr(c.source_ids) && c.source_ids.every((id) => sourceIds.has(id)), 'broken source reference');
    assert.ok(!codes.has(c.code), `duplicate course across quarters: ${c.code}`);
    codes.add(c.code);
    assert.ok(!r.completed_courses.includes(c.code), `completed course repeated: ${c.code}`);
    if (c.status === 'in_progress') assert.ok(r.in_progress_courses.includes(c.code), 'in-progress course not in request');
    else assert.ok(!r.in_progress_courses.includes(c.code), 'planned course already in progress');
  }
}
assert.equal(data.quarters[0].id, `${r.start_year}-${r.start_term}`, 'first quarter differs from requested start');

const milestoneIds = new Set();
for (const m of data.career_milestones) {
  hasKeys(m, ['id','quarter_id','title','description','action_items','status'], 'CareerMilestone');
  assert.ok(string(m.id) && string(m.title) && typeof m.description === 'string');
  assert.ok(!milestoneIds.has(m.id), 'duplicate milestone id');
  milestoneIds.add(m.id);
  assert.ok(quarterIds.has(m.quarter_id), 'broken milestone quarter reference');
  assert.ok(arr(m.action_items) && m.action_items.every(string));
  assert.ok(['not_started','in_progress','done'].includes(m.status));
}
for (const w of data.warnings) {
  hasKeys(w, ['code','severity','message','affected_course_codes'], 'PlanWarning');
  assert.ok(string(w.code) && string(w.message));
  assert.ok(['info','warning','blocking'].includes(w.severity));
  assert.ok(arr(w.affected_course_codes) && w.affected_course_codes.every((code) => codes.has(code)), 'warning references unknown course');
}
console.log('✓ Contract fixture is internally consistent (version, quarters, sources, milestones, course load).');
