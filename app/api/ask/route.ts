import { AskRequestSchema } from '../../../types/ask';
import { answerQuestion } from '../../../lib/ask-service';
import { apiError, HttpError, PRIVATE_HEADERS, readJson } from '../../../lib/http';
import { gateAi } from '../../../lib/rate-limit';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const parsed = AskRequestSchema.safeParse(await readJson(request));
    if (!parsed.success) return apiError('INVALID_REQUEST', 'Provide a question (3–500 characters) and optional major, official_only, plan_course_ids and use_ai fields.', 400,
      parsed.error.issues.map(i => `${i.path.join('.') || 'body'}: ${i.message}`));
    const gate = gateAi(request, parsed.data.use_ai);
    const result = await answerQuestion(gate.allowed ? parsed.data : { ...parsed.data, use_ai: false });
    if (!gate.allowed) result.warnings.unshift(gate.warning);
    return Response.json(result, { headers: PRIVATE_HEADERS });
  } catch (error) {
    if (error instanceof HttpError) return apiError(error.code, error.message, error.status);
    return apiError('ASK_ERROR', 'Could not answer from the bundled sources. Run npm run validate:data if data files changed.', 500);
  }
}
