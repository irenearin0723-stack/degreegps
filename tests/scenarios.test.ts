import test from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from '../lib/data';
import { generatePlan } from '../lib/plan-service';
import { scenarios, verifyScenario, VALIDATION_NOW } from '../scripts/backend-scenarios';
for (const scenario of scenarios) test(`real-data scenario ${scenario.id}: ${scenario.title}`, async () => {
  const { courses } = await loadData();
  const response = await generatePlan(scenario.request, { now: VALIDATION_NOW });
  verifyScenario(scenario, response, courses, VALIDATION_NOW);
});
test('changing internship to research changes the roadmap rather than reusing mock output', async () => {
  const internship = await generatePlan(scenarios[1].request, { now: VALIDATION_NOW });
  const research = await generatePlan(scenarios[8].request, { now: VALIDATION_NOW });
  assert.notDeepEqual(internship.career_milestones.map(m => m.action), research.career_milestones.map(m => m.action));
  assert.ok(research.career_milestones.some(m => /professor outreach/.test(m.action)));
});
test('explicit mock generation uses isolated synthetic rules, never the replaced official-data import', async () => {
  const mock = await generatePlan(scenarios[0].request, { now: VALIDATION_NOW, mock: true });
  assert.equal(mock.mode, 'mock');
  assert.ok(mock.warnings.some(w => w.code === 'UNVERIFIED_CATALOG'));
  assert.ok(mock.quarters.flatMap(q => q.courses).length > 0);
  assert.ok(mock.sources.every(s => s.kind === 'mock' && s.url === null));
});
