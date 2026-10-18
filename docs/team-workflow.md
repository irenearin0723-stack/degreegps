# DegreeGPS team workflow — DubHacks MVP

## Before coding

1. Read `types/plan.ts` and `docs/api-contract.md`.
2. Use Node.js 22, then run `npm ci`, `npm run check`, and `npm run build`.
3. Keep frontend and backend in one Next.js app (`npm run dev`, port 3000). Use relative `/api/...` requests; no separate backend origin is needed.

## Suggested ownership

| Role | Owns | Must provide to the others |
| --- | --- | --- |
| Integration / lead | contract, GitHub PR review, end-to-end demo | changes to all shared interfaces, stable `main` |
| Frontend + UI | form, course timeline, milestones, responsive interface | sends JSON exactly as `PlanRequest`, renders `PlanResponse` |
| Planner / backend | `POST /api/plan`, validating inputs, quarter sequencing | `PlanResponse` or `ApiErrorResponse` exactly |
| Data / RAG + QA | official UW docs, citations, candidate constraints, test cases | `PlanSource` data and verified facts; uncertainty warnings |

For a small team, one person can combine multiple roles. Less-experienced programmers can help with source collection, mock-based UI, QA, and written test cases without blocking the backend.

## Branch workflow

- `main`: the integrated app (frontend + backend + data); integrates tested changes only.
- `backend`: mirrors `main` for ongoing backend and data work; merge it into `main` after `npm run check` and `npm run build` pass.
- Feature branches: `feat/frontend`, `feat/planner`, `feat/rag`, `feat/design` (or unique names per person).
- After pulling, run `npm ci` (stop `npm run dev` first on Windows, since it locks `node_modules`).
- Make a small PR for every major integration; ask one teammate to approve and ensure GitHub Actions is green.
- Do **not** force-push to `main`.
- Do **not** silently change key names, enum spellings, required fields, or status codes.

## Contract change checklist

- [ ] Type changed in `types/plan.ts`
- [ ] Canonical JSON updated in `mocks/sample-plan.json`
- [ ] Rules/examples updated in `docs/api-contract.md`
- [ ] `examples/sample-request.json` updated if request changed
- [ ] `npm run check` passes
- [ ] Frontend and backend owners coordinate breaking changes (v1 artifacts are archived; new clients use v2)

## End-to-end smoke test

1. Form inputs produce a valid `PlanRequest`.
2. Backend returns HTTP 200 with full `PlanResponse` for a feasible request.
3. UI renders every planned quarter in order through the expected graduation quarter (no summers), including quarters with nothing left to plan.
4. UI renders milestones, source links, and warnings; `mock` mode displays a demo label.
5. Bad inputs return a 400 error, not a blank screen.
6. Generated recommendations do not claim verified prerequisites without official evidence.
