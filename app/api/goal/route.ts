import { z } from 'zod';
import { interpretGoal } from '../../../lib/ai';
import { apiError, HttpError, PRIVATE_HEADERS, readJson } from '../../../lib/http';
export const runtime = 'nodejs';
const InputSchema = z.object({ text: z.string().trim().min(1).max(2000), use_ai: z.boolean().default(false) }).strict();
export async function POST(request: Request) {
  try {
    const parsed = InputSchema.safeParse(await readJson(request));
    if (!parsed.success) return apiError('INVALID_REQUEST', 'Provide goal text (1–2000 characters) and optional use_ai boolean.', 400);
    return Response.json(await interpretGoal(parsed.data.text, parsed.data.use_ai), { headers: PRIVATE_HEADERS });
  } catch (error) {
    if (error instanceof HttpError) return apiError(error.code, error.message, error.status);
    return apiError('GOAL_ERROR', 'Could not interpret this goal. Select the structured fields manually.', 500);
  }
}
