# DegreeGPS

One Next.js App Router app (frontend + API routes) for transcript review, deterministic
academic planning, and goal-specific career/research preparation. No database,
authentication service, or real transcript persistence. This is not an official UW degree audit.

## Repository layout

| Path | What lives there |
| --- | --- |
| `app/` | Pages (`page.tsx`) and API routes (`app/api/{plan,transcript,goal}`) |
| `components/` | Frontend UI (form, dashboard, transcript upload, demo account) |
| `lib/` | Planner, prerequisite/offering/registration checks, data loading, browser API clients, transcript parsing |
| `types/` | Zod schemas + TypeScript types shared by frontend and backend |
| `data/` | Real UW course data the planner reads — see [data/README.md](data/README.md) |
| `mocks/` | Synthetic data for mock mode (`/api/plan/mock`) |
| `examples/` | Sample API requests/responses |
| `scripts/` | Validation, HTTP verification, and fixture generators |
| `tests/` | Unit/API tests (`npm test`) |
| `docs/` | Current guides; `docs/reports/` validation reports and generated evidence; `docs/legacy/` superseded v1 material |

## Run locally

Requires [Node.js](https://nodejs.org/) **22.13 or newer** (`node -v`); `npm` ships with it.
Use npm only — there is no pnpm lockfile.

1. Install dependencies (first time, and after pulling `package.json` changes):

   ```sh
   npm ci
   ```

2. Create `.env.local` from the template (first time only). No key is needed for
   core planning; leave the mock flags `false` to use the real backend.

   | Shell | Command |
   | --- | --- |
   | macOS / Linux / Git Bash | `cp .env.example .env.local` |
   | Windows PowerShell | `Copy-Item .env.example .env.local` |
   | Windows cmd | `copy .env.example .env.local` |

3. Start the dev server and open http://localhost:3000 (stop with `Ctrl+C`):

   ```sh
   npm run dev
   ```

On the original Mac workspace, a project-local Node lives in the Git-ignored `.tools`
folder; put it on `PATH` first with
`export PATH="$PWD/.tools/node-v22.23.3-darwin-arm64/bin:$PATH"`.

### Troubleshooting

- **"Course or career data is missing or invalid"** — a data file disagrees with another
  (e.g. `registration_rules.json` vs `sections.json`). Run `npm run validate:data` for details.
- **`npm ci` fails with EPERM/EBUSY** — stop any running `npm run dev` first; it locks
  files in `node_modules`.
- **`'tsc'`/`'next'` is not recognized** — `node_modules` is incomplete; rerun `npm ci`.
- **Port 3000 in use** — another dev server is running; stop it or use `npm run dev -- -p 3001`.
- **Plan always looks like sample data** — `.env.local` has `NEXT_PUBLIC_USE_MOCK_DATA=true`
  (copied from an older template); set it to `false` and restart.

### Checks

```sh
npm run check    # TypeScript, imported-data validation, unit/API tests, fixture validation
npm run build    # production compilation and route verification
npm run start   # serve the production build
```

## Endpoints

| Endpoint | Purpose |
| --- | --- |
| `POST /api/transcript` | One `file` PDF in multipart/form-data; local extraction with mandatory review |
| `POST /api/plan` | Confirmed course IDs + structured goal; deterministic three-quarter plan |
| `GET /api/plan/mock` | Fictional, explicitly labeled dashboard fixture |
| `POST /api/goal` | Optional goal interpretation; user confirms fields before planning |
| `POST /api/ask` | Cited answers to planning questions from bundled data (RAG); see [API contract](docs/api-contract.md#post-apiask) |

Try the planning API:

```sh
curl -sS http://localhost:3000/api/plan \
  -H 'Content-Type: application/json' \
  --data-binary @examples/sample-request.json
curl -sS http://localhost:3000/api/plan/mock
sh examples/transcript-request.sh /path/to/transcript.pdf
```

Request and response examples are in `examples/`; the full dashboard fixture is
`mocks/sample-plan.json`. For live production-mode smoke checks, start a server on
port 3100 (`npm run start -- --port 3100`), then run
`node --import tsx scripts/smoke-api.ts`. This generates fictional PDFs in memory
and refreshes the two example response JSON files. No real student files are used.

## Important data boundary

The current import contains **64 real catalog records**, with human-curated source
URLs and dates, in `data/target_courses/`. The adapter preserves OR-of-AND
prerequisites, grade minima, and explicit concurrency. There are **58 listed
Winter 2027 offerings**, six absent entries, and no Spring/Summer offering evidence.

**Schema validity does not establish registration eligibility.** The new
`projected_offerings.json` adds dated evidence from three official departmental
pages. Winter 2027 has 58 confirmed listing snapshots; Spring has 49 projected
records and Summer has five (AMATH only). Other term/course combinations remain
unknown. A projection is tentative and never establishes seats or permission.

The planner accepts confirmed/projected offerings when prerequisites and verified
major eligibility are satisfied. Unknown restrictions remain blocked from validated
`quarters[].courses`; ranked, prerequisite-satisfied adviser-review candidates are
separately returned through the existing quarter `notes` and
`COURSE_REVIEW_REQUIRED` warnings. These candidates never satisfy future prerequisites.
Quarter-level planning does not require lecture/quiz meeting times. Specific section
registration, timing, and add-code checks are future work, not silently certified.

`mocks/course-data.json` and `/api/plan/mock` remain explicitly synthetic and
separate from real planning. Never hide mock labels, warnings, or tentative status.

See [the backend validation report](docs/reports/backend-validation-report.md) for exact
counts, checklist results, executed scenarios, remaining blockers, and a full
real-data response. Source URLs/dates preserve the data teammate's provenance;
the three departmental offering pages were checked directly; remaining enrollment restrictions were not inferred or cleared.

## Optional AI support (OpenAI or Gemini)

Copy `.env.example` to `.env.local` and add your key locally, if desired. Core APIs
work without it. Never use a `NEXT_PUBLIC_` key variable.

- `/api/goal` defaults to local interpretation. `use_ai: true` explicitly opts in to
  sending goal text to OpenAI. Do not enter personal identifiers.
- `/api/plan` defaults to deterministic summaries. `use_ai_explanation: true` opts
  in to sending the goal, preferences, and generated course-plan sentences to OpenAI.
- The server uses Chat Completions with Zod structured output, an 8-second timeout, and
  no retries. `OPENAI_BASE_URL` selects any OpenAI-compatible provider (e.g. Gemini; see
  `.env.example`). Provider retention policies apply. No transcript PDF, raw transcript text, grades, or student header is sent.
- `/api/ask` defaults to local keyword retrieval with an extractive answer. `use_ai: true`
  sends only the question, retrieved public-data snippets and, with `plan`, the student's plan
  statuses (never grades) to the provider; answers citing
  course codes or dates absent from their sources are rejected. Build the optional
  embedding index with `npm run build:index`.
- All AI use is rate-limited (default 5/min and 30/day per client, 300/day overall);
  over the limit, the local answer is returned with an `AI_RATE_LIMITED` warning. See
  [AI rate limits](docs/api-contract.md#ai-rate-limits).
- AI explanations select and order approved, grounded sentences. They cannot add
  factual prose, change courses/terms, override prerequisites, or invent citations.
- Missing keys, refusals, invalid output, and request failures fall back locally.

Implementation reference: [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

## Handoff and implementation map

- [API contract and migration](docs/api-contract.md) — frontend usage and v1 → v2 mapping.
- [Dataset format](docs/data-format.md) — course AND/OR rules, validation, career paths.
- [Backend handoff](docs/backend-handoff.md) — files, privacy, limitations, verification.
- `types/{plan,transcript,course}.ts` — browser-safe shared schemas and inferred types.
- `app/api/` — thin Node route handlers and consistent structured errors.
- `lib/{planner,prerequisites,career}.ts` — deterministic planning logic.
- `lib/transcript/` — local parsing, normalization, upload validation.
- `lib/{ai,plan-service,data,retrieval}.ts` — server-only orchestration and optional AI.
- `lib/{rag-corpus,ask-service,rate-limit}.ts` — retrieval corpus, cited Q&A for `/api/ask`, AI budget.
- `tests/` — prerequisite, planner, upload, transcript, goal, and fallback tests.
- `.github/workflows/contract-check.yml` — reproducible CI checks and production build.

Contract v2 is a coordinated breaking update for the structured-goal backend.
Original v1 types/docs/examples are preserved under `docs/legacy/` for teammate
migration. Do not use them in new clients.

No changes are automatically committed or pushed. See [team workflow](docs/team-workflow.md).

## Frontend integration

The teammate frontend is retained. Browser API clients adapt the legacy UI view model
to the canonical v2 backend schemas. Real same-origin APIs are enabled by default.
See `docs/frontend-integration.md` for supported goals, transcript limits, and verification.
Use `npm ci`; `package-lock.json` is the canonical lockfile for the combined app.
