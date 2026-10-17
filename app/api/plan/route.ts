import { PlanRequestSchema } from '../../../types/plan';
import { generatePlan } from '../../../lib/plan-service';
import { DataError } from '../../../lib/data';
import { HttpError, apiError, readJson, PRIVATE_HEADERS } from '../../../lib/http';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const result = PlanRequestSchema.safeParse(await readJson(request));
    if (!result.success) return apiError('INVALID_REQUEST', 'Check the request fields and supported goal combination.', 400,
      result.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`));
    return Response.json(await generatePlan(result.data), { headers: PRIVATE_HEADERS });
  } catch (error) {
    if (error instanceof HttpError) return apiError(error.code, error.message, error.status);
    if (error instanceof DataError) return apiError('DATA_UNAVAILABLE', error.message, 503);
    return apiError('INTERNAL_ERROR', 'The plan could not be generated. Please retry.', 500);
  }
}
