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
  const isResearch = request.target_role.includes('Research Assistant');
  const isExplore = request.target_role.includes('Exploration');
  const isProfile = request.target_role.includes('Profile & Project');
  const career_milestones = isResearch ? fixture.career_milestones.map((item, index) => ({
    ...item,
    title: ['Map relevant UW labs', 'Build research readiness', 'Prepare thoughtful outreach', 'Research or scoped replication project'][index],
    description: ['Identify labs whose current work genuinely matches your interests.', 'Read recent papers and close one concrete technical gap.', 'Draft personalized messages that reference specific work.', 'Pursue an RA opportunity or complete a credible fallback project.'][index],
    action_items: [['Save five relevant labs', 'Read one recent paper from each'], ['Reproduce a small result', 'Write a concise technical note'], ['Prepare a research resume', 'Draft two personalized emails'], ['Join a lab or ship a replication study', 'Publish a short retrospective']][index],
  })) : isExplore ? fixture.career_milestones.map((item, index) => ({ ...item,
    title: ['Compare three possible directions', 'Run one small path experiment', 'Talk with people in the field', 'Choose a primary direction'][index],
    description: ['Use coursework and interests as evidence, not as a permanent label.', 'Try a bounded project before committing to a path.', 'Collect first-hand context from students or mentors.', 'Select a direction and regenerate a focused plan.'][index],
    action_items: [['Compare SWE, ML, and research', 'Write questions for each path'], ['Complete one 4–6 hour experiment'], ['Schedule two informational conversations'], ['Choose one primary goal', 'Generate a new roadmap']][index],
  })) : isProfile ? fixture.career_milestones.map((item, index) => ({ ...item,
    title: ['Audit skills and existing evidence', 'Build one focused project', 'Document and publish the work', 'Choose the next opportunity'][index],
    description: ['Find the most important gap between current evidence and the target direction.', 'Scope a project that can be finished alongside coursework.', 'Explain decisions, results, and limitations clearly.', 'Use the finished work to choose an internship or research target.'][index],
    action_items: [['List current skills', 'Choose one evidence gap'], ['Define a six-week scope', 'Ship a working baseline'], ['Write a strong README', 'Request feedback'], ['Select a primary goal', 'Regenerate the roadmap']][index],
  })) : fixture.career_milestones;
  return {
    ...fixture,
    plan_id: `demo-${Date.now()}`,
    generated_at: new Date().toISOString(),
    request,
    career_milestones,
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
