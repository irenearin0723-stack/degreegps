import { writeFile } from 'node:fs/promises';
import { generatePlan } from '../lib/plan-service';
import { PlanRequestSchema } from '../types/plan';
async function main() {
  const request = PlanRequestSchema.parse({ major: 'Computer Science + Applied Mathematics',
    completed_courses: ['CSE 123', 'MATH 126'], in_progress_courses: [],
    goal: { type: 'internship', track: 'ml', deadline: '2027-06-01', notes: 'Fictional student preparing for Summer 2027.' },
    max_courses_per_term: 2, start_term: '2026-autumn', use_ai_explanation: false });
  const plan = await generatePlan(request, { mock: true, now: new Date('2026-10-17T18:00:00Z') });
  plan.plan_id = 'demo-uw-002';
  plan.plan_summary = 'DEMO ONLY: fictional CS + AMATH student preparing for a Summer 2027 ML internship. All course rules and offerings are synthetic illustrations, not verified UW advice. ' + plan.plan_summary;
  await writeFile('examples/sample-request.json', JSON.stringify(request, null, 2) + '\n');
  await writeFile('mocks/sample-plan.json', JSON.stringify(plan, null, 2) + '\n');
}
main();
