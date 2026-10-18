import { AskRequestSchema, AskResponseSchema, type AskRequest, type AskResponse } from '../types/ask';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? '';
export class AskApiError extends Error {}
/** Browser client for POST /api/ask. Answers come only from bundled data; use_ai is the user's explicit opt-in. */
export async function askQuestion(input: AskRequest): Promise<AskResponse> {
  const body = AskRequestSchema.safeParse(input);
  if (!body.success) throw new AskApiError('Ask a question of 3–500 characters.');
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/ask`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body.data) });
  } catch { throw new AskApiError('The question service is unavailable. Please retry.'); }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new AskApiError(data?.error?.message ?? `Question failed (${response.status}).`);
  const result = AskResponseSchema.safeParse(data);
  if (!result.success) throw new AskApiError('The question service returned an invalid response.');
  return result.data;
}
