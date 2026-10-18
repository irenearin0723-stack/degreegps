import sample from '../../../../mocks/sample-plan.json';
import { PlanResponseSchema } from '../../../../types/plan';
import { PRIVATE_HEADERS } from '../../../../lib/http';
export const runtime = 'nodejs';
export const maxDuration = 60;
/** Explicit demo endpoint, separate from real planning. No AI or real student data. */
export function GET() {
  return Response.json(PlanResponseSchema.parse(sample), { headers: PRIVATE_HEADERS });
}
