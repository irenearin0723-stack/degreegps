# DegreeGPS

One Next.js App Router app (frontend + API routes) for transcript review, deterministic
academic planning, and goal-specific career/research preparation. No database,
authentication service, or real transcript persistence. This is not an official UW degree audit.

## Repository layout

| Path | What lives there |
| --- | --- |
| `app/` | Pages (`page.tsx`) and API routes (`app/api/{plan,transcript,goal,ask}`) |
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
| `POST /api/plan` | Confirmed course IDs + structured goal (+ optional `graduation_term`); deterministic plan for every autumn/winter/spring quarter until graduation |
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

## Data

All data comes from official University of Washington sources (General Catalog, course
catalog, department sites, and the Winter 2027 Time Schedule snapshot of 12:03 am
October 17, 2026). See [data/README.md](data/README.md).

| Dataset | Contents |
| --- | --- |
| `data/major_requirements/program_catalog.json` | All 112 UW Seattle undergraduate majors: degrees/options, admission type, credit range, official requirement text |
| `data/major_requirements/major_requirements.json` | 30 encoded requirement profiles for 14 majors (CS, AMATH, INFO, Computer Engineering, ACMS, Statistics, Mathematics, ECE, HCDE, ISE, Physics, Economics, ME, A&A, with options), 622 rules, 119 documented issues |
| `data/target_courses/` | 351 courses with OR-of-AND prerequisites (minimum grades, concurrency), catalog offering patterns, Winter 2027 listing status (230 listed, 121 not), and 1,240 Winter 2027 sections |
| `data/target_courses/registration_rules.json` | Section restriction evidence; 90 sections have detailed SLN Notes reviewed |
| `data/archive/` | Superseded data, kept for provenance and never loaded |

## How plans are built

- **Quarters:** every autumn, winter and spring from the start quarter through
  `graduation_term` (at most 18; three when no graduation is given). Summers are never planned.
- **Requirements first:** the planner picks one requirement profile per major (the standard
  profile, or for option-only majors the option matching the career track) and schedules only
  courses that advance an unmet major or admission rule, or the prerequisite chain of one.
  It recomputes after each pick, so a satisfied option or duplicate alternative is not added.
  Each course explains which requirement it serves, and the plan reports any requirement still
  uncovered at graduation (`REQUIREMENTS_REMAINING`) or that all are covered (`REQUIREMENTS_COVERED`).
- **Prerequisites:** courses implied by completed ones (for example MATH 124/125 when MATH 126
  is done) count as completed. A missing prerequisite grade plans the course as tentative with
  a grade caveat; a reviewed grade below the minimum still blocks it.
- **Offerings:** Winter 2027 uses the Time Schedule snapshot and Spring/Summer 2027 departmental
  projections where they exist. Other quarters use the course catalog's "Offered:" pattern, or
  assume a regular quarter when the catalog publishes none. Anything not from the snapshot is
  `tentative`. A course absent from the Winter 2027 snapshot is never planned for that quarter.
- **Registration restrictions do not block planning.** Each course card states its status
  ("not verified", or a recorded restriction that does not match the major) so the student
  confirms it before registering.
- General education and degree-wide rules (for example 180 credits) are not planned; a degree
  audit is still required. Plans are not seat guarantees.

`mocks/course-data.json` and `/api/plan/mock` remain explicitly synthetic and
separate from real planning. Never hide mock labels, warnings, or tentative status.
Dated validation evidence lives in [docs/reports/](docs/reports/); those reports describe the
system at the time they were written.

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
- `/api/ask` defaults to local keyword retrieval with an extractive answer (the dashboard's
  Ask panel turns AI on by default, with a per-question checkbox to turn it off). `use_ai: true`
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
- `lib/{major-scope,requirements-progress}.ts` — major profile selection and requirement tracking.
- `lib/{offerings,registration,course-import}.ts` — offering evidence, section restrictions, data import.
- `lib/transcript/` — local parsing, normalization, upload validation.
- `lib/{ai,plan-service,data,retrieval}.ts` — server-only orchestration and optional AI.
- `lib/{rag-corpus,ask-service,rate-limit}.ts` — retrieval corpus, cited Q&A for `/api/ask`, AI budget.
- `tests/` — prerequisite, planner, upload, transcript, goal, and fallback tests.
- `.github/workflows/contract-check.yml` — reproducible CI checks and production build.

Contract v2 is a coordinated breaking update for the structured-goal backend.
Original v1 types/docs/examples are preserved under `docs/legacy/` for teammate
migration. Do not use them in new clients.

`main` is the integrated branch (frontend + backend + data); `backend` mirrors it for ongoing
backend work. See [team workflow](docs/team-workflow.md).

## Frontend integration

The teammate frontend is retained. Browser API clients adapt the legacy UI view model
to the canonical v2 backend schemas. Real same-origin APIs are enabled by default. The form
offers the 14 encoded majors and an expected graduation quarter.
See `docs/frontend-integration.md` for supported goals, transcript limits, and verification.
Use `npm ci`; `package-lock.json` is the canonical lockfile for the combined app.
