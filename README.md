# DegreeGPS — DubHacks team contract (v1.0.0)

**Purpose:** Plan at least one academic year of courses and career/internship milestones. This is a **contract-first starter**, not a deployed site or a real degree-audit system.

## Start here (all teammates)

```bash
npm install
npm run check
```

## Run the frontend

```bash
cp .env.example .env.local
pnpm install
pnpm dev
```

The frontend starts in safe mock mode and renders the canonical
`mocks/sample-plan.json` response through the same components used for the real
API. To connect the backend, set:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_USE_MOCK_DATA=false
```

The frontend then sends `POST /api/plan` using `PlanRequest` and renders the
returned `PlanResponse` without changing UI component props. API errors show the
backend-provided `error.message` and optional `details`.

Frontend implementation:

- `app/page.tsx` — landing, planner state, loading/error handling
- `components/PlanForm.tsx` — contract-compatible onboarding form
- `components/PlanDashboard.tsx` — quarters, milestones, warnings, sources
- `lib/plan-api.ts` — the only Mock/API switching boundary

- `types/plan.ts` — single source of truth for request/response TypeScript types.
- `mocks/sample-plan.json` — canonical, **demo-only** backend response.
- `docs/api-contract.md` — HTTP endpoint, conventions, and integration agreement.
- `examples/sample-request.json` — canonical request body for testing the backend.
- `scripts/check-contract.mjs` — verifies sample data and cross-file references.
- `.github/workflows/contract-check.yml` — runs verification for pushes and PRs.
- `docs/team-workflow.md` — ownership and safe merge instructions.
- `docs/github-private.md` — GitHub visibility verification and upload steps.

## How teammates integrate

1. **Frontend** imports `PlanResponse` and renders `mocks/sample-plan.json` as a timeline immediately.
2. **Backend/planner** builds `POST /api/plan`, consuming `PlanRequest` and returning `PlanResponse` exactly.
3. **Data/RAG** retrieves official UW sources, provides traceable `sources` records and prerequisite constraints to the planner; it **does not** invent requirements.
4. **UX** makes course timelines, career milestones, source links, and warnings visually understandable.

Keep the same JSON keys and data shape. Nobody unilaterally edits these three contract files; changes require a single PR updating type, mock, documentation, and tests together.

### Warning about the sample

The example UW courses and sequences are **not verified** for real prerequisite eligibility, seat availability, or degree progress. `mode: "mock"` and the `UNVERIFIED_CATALOG` warning must remain visible in demo mode.

## Create and publish to GitHub

1. Open **https://github.com/new** while logged into the GitHub account where you want this project.
2. Set repository name to `degreegps`. Under **Choose visibility**, select **Private**; *do not* initialize the repository with a README or `.gitignore` (this starter includes both). Create the repository.
3. Download/unzip the starter, open a terminal inside its folder, and execute:

```bash
git init -b main
git add .
git commit -m "chore: establish DegreeGPS team API contract"
git remote add origin https://github.com/YOUR_USERNAME/degreegps.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual owner account or organization. GitHub will ask for authentication as needed.

**IMPORTANT:** `"private": true` inside `package.json` only prevents accidental npm package publishing. It **does not make your GitHub repository private**. Check GitHub's repository header for the **Private** badge and go to **Settings → General → Danger Zone → Change repository visibility** to inspect/change it. See [`docs/github-private.md`](docs/github-private.md).
