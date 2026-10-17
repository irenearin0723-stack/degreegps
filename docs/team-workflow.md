# DegreeGPS team workflow — DubHacks MVP

## Before coding

1. Read `types/plan.ts` and `docs/api-contract.md`.
2. Run `npm install && npm run check` on the shared `main` branch.
3. Agree on **one backend origin**: local backend commonly on port 8000 and frontend dev server on port 3000 (these are examples, not mandated ports). Keep the URL in frontend config, not scattered through UI components.

## Suggested ownership

| Role | Owns | Must provide to the others |
| --- | --- | --- |
| Integration / lead | contract, GitHub PR review, end-to-end demo | changes to all shared interfaces, stable `main` |
| Frontend + UI | form, course timeline, milestones, responsive interface | sends JSON exactly as `PlanRequest`, renders `PlanResponse` |
| Planner / backend | `POST /api/plan`, validating inputs, quarter sequencing | `PlanResponse` or `ApiErrorResponse` exactly |
| Data / RAG + QA | official UW docs, citations, candidate constraints, test cases | `PlanSource` data and verified facts; uncertainty warnings |

For a small team, one person can combine multiple roles. Less-experienced programmers can help with source collection, mock-based UI, QA, and written test cases without blocking the backend.

## Branch workflow

- `main`: integrates tested changes only.
- Feature branches: `feat/frontend`, `feat/planner`, `feat/rag`, `feat/design` (or unique names per person).
- Make a small PR for every major integration; ask one teammate to approve and ensure GitHub Actions is green.
- Do **not** force-push to `main`.
- Do **not** silently change key names, enum spellings, required fields, or status codes.

## Contract change checklist

- [ ] Type changed in `types/plan.ts`
- [ ] Canonical JSON updated in `mocks/sample-plan.json`
- [ ] Rules/examples updated in `docs/api-contract.md`
- [ ] `examples/sample-request.json` updated if request changed
- [ ] `npm run check` passes
- [ ] Frontend and backend owners both approve breaking changes

## End-to-end smoke test

1. Form inputs produce a valid `PlanRequest`.
2. Backend returns HTTP 200 with full `PlanResponse` for a feasible request.
3. UI renders all quarters in order, even an empty summer quarter.
4. UI renders milestones, source links, and warnings; `mock` mode displays a demo label.
5. Bad inputs return a 400 error, not a blank screen.
6. Generated recommendations do not claim verified prerequisites without official evidence.
