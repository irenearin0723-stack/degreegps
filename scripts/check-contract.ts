import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PlanResponseSchema, PlanRequestSchema } from '../types/plan';
import { consecutiveTerms } from '../lib/planner';
import { loadData } from '../lib/data';
async function main() {
  const plan = PlanResponseSchema.parse(JSON.parse(await readFile('mocks/sample-plan.json', 'utf8')));
  const request = PlanRequestSchema.parse(JSON.parse(await readFile('examples/sample-request.json', 'utf8')));
  assert.deepEqual(plan.request, request);
  assert.equal(plan.mode, 'mock');
  assert.deepEqual(plan.quarters.map(q => q.term), consecutiveTerms(request.start_term!));
  assert.ok(plan.quarters.every(q => q.courses.every(c => c.scheduling_status === 'tentative')));
  const ids = new Set(plan.quarters.flatMap(q => q.courses.map(c => c.id)));
  for (const milestone of plan.career_milestones) {
    assert.ok(milestone.related_course_ids.every(id => ids.has(id)));
    assert.ok(milestone.timeframe.start <= milestone.timeframe.end);
  }
  await loadData();
  console.log('Contract v2, canonical fixture, cross-references, and datasets validated.');
}
main();
