import samplePlan from '../mocks/sample-plan.json';
import type { ApiErrorResponse, PlanRequest, PlanResponse } from '../types/plan';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? '';
const USE_MOCK_DATA = process.env.NEXT_PUBLIC_USE_MOCK_DATA !== 'false';

export class PlanApiError extends Error {
  constructor(
    message: string,
    public readonly code = 'INTERNAL_ERROR',
    public readonly details: string[] = [],
  ) {
    super(message);
  }
}

function mockForRequest(request: PlanRequest): PlanResponse {
  const fixture = structuredClone(samplePlan) as PlanResponse;
  return {
    ...fixture,
    plan_id: `demo-${Date.now()}`,
    generated_at: new Date().toISOString(),
    request,
  };
}

export async function createPlan(payload: PlanRequest): Promise<PlanResponse> {
  if (USE_MOCK_DATA) {
    await new Promise((resolve) => setTimeout(resolve, 1350));
    return mockForRequest(payload);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new PlanApiError('The planning service is unavailable. Check the backend URL and try again.');
  }

  const data = (await response.json().catch(() => null)) as PlanResponse | ApiErrorResponse | null;
  if (!response.ok) {
    const error = data && 'error' in data ? data.error : null;
    throw new PlanApiError(error?.message ?? `Planning request failed (${response.status})`, error?.code, error?.details);
  }
  if (!data || !('schema_version' in data) || !Array.isArray(data.quarters)) {
    throw new PlanApiError('The backend returned an invalid planning response.');
  }
  return data;
}

export function isMockMode() {
  return USE_MOCK_DATA;
}
