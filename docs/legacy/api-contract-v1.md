# DegreeGPS API Contract (v1.0.0)

**Status:** Frozen for the hackathon MVP. **Owners:** everyone on the team.  
**Source of truth:** [`types/plan.ts`](../types/plan.ts).  
**Canonical sample:** [`mocks/sample-plan.json`](../mocks/sample-plan.json).

## Goal

A student provides major(s), courses taken, internship goal, and workload preference. The backend returns a quarter-by-quarter academic plan and parallel career milestones. The frontend should be able to render **the mock response today** and replace it with **the real API response later without rewriting its UI**.

> The mock is **not** verified academic advice. Before presenting a generated plan as reliable, validate prerequisites, degree requirements and course offerings against official UW sources.

## Endpoint

`POST /api/plan`

Headers: `Content-Type: application/json`  
Success: `200 OK` with a `PlanResponse` object.  
Invalid input: `400 Bad Request` with `ApiErrorResponse`.  
Cannot produce feasible plan: `422 Unprocessable Entity` with `ApiErrorResponse`.  
Unexpected failure: `500 Internal Server Error` with `ApiErrorResponse`.

The path is relative to whatever origin hosts the backend. Frontend developer may configure the backend base URL via environment variables; do not hardcode production domains.

### Request example

```json
{
  "majors": ["Computer Science", "Applied Mathematics"],
  "completed_courses": ["CSE 123", "MATH 126"],
  "in_progress_courses": ["CSE 311", "CSE 351", "INFO 201"],
  "target_role": "Machine Learning Engineer Intern",
  "target_summer": 2027,
  "max_courses_per_term": 3,
  "start_term": "autumn",
  "start_year": 2026,
  "horizon_terms": 4
}
```

### Request rules

| Field | Required | Rules |
| --- | --- | --- |
| `majors` | yes | Nonempty list of strings; supports double majors |
| `completed_courses` | yes | Array of course codes, `[]` allowed |
| `in_progress_courses` | yes | Array of course codes, `[]` allowed |
| `target_role` | yes | Nonempty string, e.g. `ML Engineer Intern` |
| `target_summer` | yes | Four-digit integer year |
| `max_courses_per_term` | yes | Integer in `[1,5]`, includes in-progress courses |
| `start_term` | yes | `autumn`, `winter`, `spring` or `summer` |
| `start_year` | yes | Four-digit integer year |
| `horizon_terms` | yes | Integer in `[1,8]`; summer counts as one term |

Normalize course codes to uppercase with a single space, e.g. `cse311` -> `CSE 311`. Remove duplicates. A course must not appear in both completed and in-progress arrays; reject conflicting inputs with `400`.

### Response example

The entire JSON file at [`mocks/sample-plan.json`](../mocks/sample-plan.json) is the canonical response fixture. **Do not hand-maintain a second, contradictory response example here.**

The success JSON has exactly these top-level keys:

```text
schema_version          "1.0.0"
plan_id                 string
mode                    "mock" | "generated"
generated_at            ISO-8601 datetime
request                 PlanRequest (normalized echo)
quarters                QuarterPlan[]
career_milestones       CareerMilestone[]
warnings                PlanWarning[]
sources                 PlanSource[]
```

### Required semantics / UI promises

1. **Names and casing never change.** All JSON keys use `snake_case`. TypeScript uses identical keys. No silent conversions to camelCase.
2. **IDs are stable and unique.** Quarter IDs are `YYYY-term`, e.g. `2027-winter`. `career_milestones[].quarter_id` must refer to a returned quarter. `courses[].source_ids` must refer to IDs in `sources`.
3. **Quarter order is chronological.** `autumn → winter → spring → summer` **across academic-year boundaries**: for example `2026-autumn → 2027-winter → 2027-spring → 2027-summer → 2027-autumn`. Summer may have `courses: []`.
4. **Do not exceed workload.** Every quarter has at most `max_courses_per_term` courses, including courses already in progress. No completed course may be planned again.
5. **Truthful uncertainty.** Use `credits: null` when credits are unverified. `source_ids: []` is valid when there is no source. Never invent citations, prerequisites, degree fulfillment, course availability, or internship guarantees. Add a warning for material unknowns.
6. **Separation of concerns.** Backend owns planning logic and validation. Frontend owns layout and interaction. Retrieval/RAG owns source lookup and returns source metadata to the backend. Frontend **must not** infer academic prerequisites.
7. **Rendering errors.** Show `error.message` for 4xx/5xx cases; do not treat an error response as a successful plan.
8. **Term-specific milestones.** Every milestone points at a quarter. Career milestones may exist for terms with no classes.

### Error example

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "max_courses_per_term must be between 1 and 5",
    "details": ["Received: 7"]
  }
}
```

## Frontend integration

- During UI work, import and render `mocks/sample-plan.json` as if it came from the server.
- Frontend types come from `types/plan.ts`, e.g. `import type { PlanResponse } from '../types/plan'` (adjust relative import path to your app).
- All UI components should take **one `PlanResponse`** rather than ad-hoc unrelated data.
- When backend is ready, replace the mock-loading function with a `fetch` call to `POST /api/plan`; keep rendering components unchanged.
- Do not display a real-catalog/source badge when `mode: "mock"` or when `sources[].kind: "mock"`.

Example networking layer (adapt the path to your framework):

```ts
import type { PlanRequest, PlanResponse, ApiErrorResponse } from './types/plan';

export async function createPlan(
  baseUrl: string,
  payload: PlanRequest
): Promise<PlanResponse> {
  const res = await fetch(`${baseUrl}/api/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = (await res.json()) as ApiErrorResponse;
    throw new Error(data.error?.message ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as PlanResponse;
}
```

TypeScript `as PlanResponse` is a *compile-time assertion*, not runtime validation. Backend must validate incoming JSON. Frontend can add runtime response validation before production.

## Backend + future RAG agreement

The first backend endpoint may return the unchanged sample JSON to unblock the frontend. Later, replace the hard-coded JSON with planning logic and retrieved source documents **without changing the response shape**.

Future RAG integration:

1. Retrieve relevant official UW catalog / departmental documents.
2. Parse prerequisites and degree requirements into structured constraints.
3. Validate proposed course sequences deterministically against those constraints.
4. Put the retrieved records in `sources` (with actual URL and retrieval time), and reference them via `source_ids` on related courses.
5. Add `warnings` when sources conflict or constraints cannot be verified. RAG retrieval alone does not guarantee correctness.

## Git workflow / change policy

- `main` is the integration branch. Each person works on a separate feature branch: `feat/frontend`, `feat/planner`, `feat/data`, `feat/design` (or name-specific branches).
- Open a Pull Request to `main`, ideally reviewed by one teammate. Never force-push `main`.
- **No breaking changes** to these types or API fields during the hackathon unless all owners approve. For a breaking change, bump `schema_version`, update type + mock + docs + any consumers in the **same PR**.
- Run `npm run check` before merging. GitHub Actions runs the same check on every PR.
- The person responsible for integration tests the full mock→backend swap after PR merges.

## MVP definition of done

A teammate can clone the repo, run `npm install && npm run check`, open the sample JSON, and build a term timeline without waiting for the planner implementation. Planner can independently return the agreed shape. RAG team can add source records without changing the UI.

## Team starter extras

- Use [`examples/sample-request.json`](../examples/sample-request.json) as the exact request fixture for backend smoke tests; `npm run check` ensures it matches the request echoed by the sample response.
- Read [`team-workflow.md`](team-workflow.md) for branch naming and the contract-change checklist.
- Follow [`github-private.md`](github-private.md) for **GitHub repository** visibility. The npm `private` flag is unrelated to GitHub visibility.
