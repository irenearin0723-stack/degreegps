# DegreeGPS — Backend & AI MVP

A Next.js App Router backend for transcript review, deterministic academic planning,
and goal-specific career/research preparation. No database, authentication service,
or real transcript persistence. This is not an official UW degree audit.

## Start on this Mac

Node.js 22 is required. This workspace has a checksum-verified, project-local Node
installation, ignored by Git. In the VS Code terminal, from this folder:

```sh
export PATH="$PWD/.tools/node-v22.23.3-darwin-arm64/bin:$PATH"
npm run dev
```

Open http://localhost:3000. The homepage is a minimal handoff placeholder for Member 2.
After cloning elsewhere, install Node.js 22 (or `nvm use`), then run `npm ci` and
`npm run dev`. The `.tools` directory is machine-local and is not distributed.

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

See [the backend validation report](docs/backend-validation-report.md) for exact
counts, checklist results, executed scenarios, remaining blockers, and a full
real-data response. Source URLs/dates preserve the data teammate's provenance;
the three departmental offering pages were checked directly; remaining enrollment restrictions were not inferred or cleared.

## Optional OpenAI support

Copy `.env.example` to `.env.local` and add your key locally, if desired. Core APIs
work without it. Never use a `NEXT_PUBLIC_` key variable.

- `/api/goal` defaults to local interpretation. `use_ai: true` explicitly opts in to
  sending goal text to OpenAI. Do not enter personal identifiers.
- `/api/plan` defaults to deterministic summaries. `use_ai_explanation: true` opts
  in to sending the goal, preferences, and generated course-plan sentences to OpenAI.
- The server uses the Responses API with Zod structured output, `store: false`, an
  8-second timeout, and no retries. `store: false` does not imply zero provider
  retention. No transcript PDF, raw transcript text, grades, or student header is sent.
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
- `tests/` — prerequisite, planner, upload, transcript, goal, and fallback tests.
- `.github/workflows/contract-check.yml` — reproducible CI checks and production build.

Contract v2 is a coordinated breaking update for the structured-goal backend.
Original v1 types/docs/examples are preserved under `docs/legacy/`, `mocks/legacy/`,
and `examples/legacy/` for teammate migration. Do not use them in new clients.

No changes are automatically committed or pushed. See [team workflow](docs/team-workflow.md).
