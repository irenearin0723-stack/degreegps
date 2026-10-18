# Frontend/backend integration

Integration branch: `integration/backend-frontend`. The backend snapshot is
`8056322`; teammate main was merged from `3b7d09b` (seven frontend commits after
the original shared starter). Main itself is not reset or overwritten.

## What was preserved and reconciled

- Teammate landing, onboarding, dashboard, account demo, components, CSS, Tailwind
  and shadcn setup are retained. Local backend placeholder pages were backed up
  in a temporary directory and excluded from the backend commit.
- Backend v2 schemas/route handlers and all prerequisite/offering/eligibility rules
  stay canonical. `types/ui-plan.ts` is a legacy **UI view model**, never the
  HTTP schema. Existing component imports now explicitly refer to that view model.
- `lib/plan-api.ts` converts UI input to validated v2 requests and maps validated
  responses into the teammate dashboard shape. The selected structured goal,
  notes, flexible deadline, course IDs and course limit are preserved.
- Quarter deadlines mean preparation **before** Jan 1 / Apr 1 / Jun 1 / Sep 1;
  this approximation is disclosed in the form. Flexible remains null, never a
  fabricated Summer 2028 deadline. Editing/regenerating retains the goal draft.
- Goal controls expose only supported backend combinations; unsupported saved
  directions fail clearly instead of being silently mapped to another profession.
- Real responses must echo the normalized submitted profile and generated mode; mismatched/mock responses are rejected.
- Real same-origin APIs are the default. Mock mode requires explicit `true` in
  `.env.local`; failures never silently substitute fictional history or plans.
- PDF upload uses `POST /api/transcript` with field `file`. UI size/type limits now
  match the backend (text-based PDF, 5 MiB). Images/OCR remain unsupported. Ambiguous,
  repeated, failed and transfer records stay uncertain until reviewed. No fabricated
  extraction confidence percentages are shown.
- Projected courses remain tentative. Review-only candidates stay in quarter notes
  and warnings, never fabricated course cards or prerequisite completions.
- Transcript import sends `reviewed_grades` for confirmed completed rows with a numeric
  grade (0.0–4.0); credit-only grades and courses listed with conflicting grades are
  left out, and grades are dropped for courses later removed from the completed list.
- Plan warnings are grouped by code (most severe first), showing two per group with
  "Show N more".
- The dashboard shows the backend `plan_summary`. **Explain with AI** re-requests the
  same plan with `use_ai_explanation: true` (explicit opt-in, disclosed next to the
  button); courses and eligibility are unchanged, and quoted policy records appear in
  the sources list. Hidden for mock plans.
- **Ask about your route** (`components/AskPanel.tsx`, `lib/ask-api.ts`) calls
  `POST /api/ask` with the plan's inputs as `plan` (omitted for mock plans), its course
  IDs, and the major when there is exactly one. Plan sources show a "Your plan" label. AI answers are a per-question opt-in checkbox; the default answer quotes the
  closest bundled record. Citations, related sources, warnings (including
  `AI_RATE_LIMITED`) and the disclaimer are always shown.
- Career milestones retain their recommended date ranges; the legacy timeline
  groups them into the nearest available displayed quarter without changing dates.
- npm is the combined project's package manager. `package-lock.json` includes both
  sets of dependencies; the obsolete pnpm lockfile was removed. Use `npm ci`.
- Build/dev use Webpack because this execution environment rejects the local
  PostCSS worker port used by Turbopack. The complete Webpack build passes.

## Start

```sh
export PATH="$PWD/.tools/node-v22.23.3-darwin-arm64/bin:$PATH"
npm run dev
```

Open http://localhost:3000. `.env.example` documents optional flags. No API key is
needed. Demo accounts remain the teammate's browser-local demo, not real backend
user authentication. Real transcript PDFs are not persisted or sent to AI.

## Validation

- `npm run check`: 96 unit/integration tests, TypeScript, dataset and mock validation.
- `npm run build`: production build including the teammate UI, Tailwind and APIs.
- `npm run validate:data:artifacts`: 1,378 data integrity assertions.
- `npm run verify:http`: existing backend HTTP regression suite (31 checks).
- `scripts/browser-smoke.cjs`: six actual Chrome checks including hydration, file
  upload, explicit confirmation, supported research goals, null deadline, real
  generated response, dashboard render and edit restoration. No browser runtime errors.

The optional browser script uses `playwright-core` installed only in a temporary
folder, with the existing system Chrome. It is not a runtime dependency. Run a
production server on 127.0.0.1:3101 and provide `DEGREEGPS_PLAYWRIGHT_PATH` pointing
at that installation. Screenshot output is temporary and not committed; the JSON
summary is `docs/reports/frontend-browser-validation.json`. All test data is fictional and
AI calls are disabled. Browser-only verification does not certify enrollment,
seat availability, OCR support or production authentication.

The direct HTTP suite additionally expects its isolated no-data server on port
3102; this checks 503 without renaming/removing the shared data directory.
