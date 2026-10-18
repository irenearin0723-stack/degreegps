> **Current behavior (2026-10-17):** plans cover every autumn/winter/spring quarter until
> `graduation_term`, follow the matched major requirement profile, and no longer hold courses
> back for unverified registration eligibility. See the README section
> [How plans are built](../README.md#how-plans-are-built) and the [API contract](api-contract.md).
> The notes and counts below describe earlier milestones and are kept as history.

> Projected-offering update: [validation report](reports/backend-validation-report.md).
> 88 tests and 31 actual HTTP checks pass. Quarter-level recommendations accept
> confirmed/projected evidence, with projections tentative. Missing section times
> are metadata only. Unknown registration stays outside validated assignments;
> dated review-only candidates are returned through notes/warnings for all three
> quarters in the CS + AMATH example. Earlier counts below are historical.

> Latest verification: see [backend-validation-report.md](reports/backend-validation-report.md).
> There are now 64 imported real catalog records; enrollment restrictions remain
> unresolved and only Winter 2027 offerings are evidenced. The final suite has
> 75 passing tests plus 30 actual HTTP checks. Earlier implementation counts below
> describe the initial MVP, not the current validated dataset.

# Backend handoff — implemented MVP

## What is implemented

- Next.js App Router with Node route handlers; no frontend design or existing UI overwritten.
- Shared Zod-inferred interfaces for planning, course rules, transcript review, warnings, and errors.
- Bounded multipart PDF upload, MIME/signature/file-size/page-count validation, in-memory PDF text extraction.
- Conservative transcript line parsing with explicit progress, numeric/CR/S completion,
  withdrawal/failure, repeated attempts, transfer uncertainty, and mandatory confirmation.
- AND/OR prerequisites, conservative unknown rules, missing-prerequisite explanations,
  strict prior-quarter ordering, no duplicate courses, and course-load caps.
- Requirement-aware greedy selection: courses that advance an unmet major/admission rule (or its prerequisite chain) first, then foundation priority × 10 + track match × 30 + unlock count.
- Plans through the expected graduation quarter (summers skipped) with partial-schedule warnings, tentative dependent suggestions, and a remaining-requirements report.
- Goal-specific internship, research, projects, and exploration roadmaps, skills and project practice.
- Recommended deadline-relative timeframes and close/past-deadline feasibility warnings.
- Optional server-only structured OpenAI goal interpretation and constrained grounded explanation.
- Local fallback for absent API keys, malformed/refused AI output, network failure, and timeout.
- Dedicated mock endpoint.
- `/api/ask`: cited Q&A over bundled data (local keyword retrieval; optional embeddings and grounded AI answers).
- Canonical fictional examples, unit/API tests, actual HTTP smoke script, CI checks, and lockfile.

## Files created or changed

| Group | Files |
| --- | --- |
| App | `app/layout.tsx`, `app/page.tsx`, `app/api/plan/route.ts`, `app/api/plan/mock/route.ts`, `app/api/transcript/route.ts`, `app/api/goal/route.ts` |
| Shared contract | `types/plan.ts`, `types/course.ts`, `types/transcript.ts` |
| Core | `lib/prerequisites.ts`, `lib/planner.ts`, `lib/career.ts`, `lib/data.ts`, `lib/http.ts`, `lib/plan-service.ts` |
| PDF | `lib/transcript/parser.ts`, `lib/transcript/normalize.ts`, `lib/transcript/validate.ts` |
| AI/retrieval | `lib/ai.ts`, `lib/retrieval.ts`, `lib/rag-corpus.ts`, `lib/ask-service.ts`, `lib/rate-limit.ts`, `app/api/ask/route.ts`, `types/ask.ts`, `scripts/build-index.ts` |
| Data | `data/courses.json`, `data/career_paths.json`, `mocks/sample-plan.json` |
| Examples | `examples/sample-request.json`, `examples/plan-response.json`, `examples/transcript-response.json`, `examples/transcript-text.txt`, `examples/transcript-request.sh` |
| Verification | `tests/api.test.ts`, `tests/prerequisites.test.ts`, `tests/transcript.test.ts`, `scripts/check-contract.ts`, `scripts/generate-sample.ts`, `scripts/smoke-api.ts` |
| Config | `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `next-env.d.ts`, `.nvmrc`, `.env.example`, `.gitignore`, `.github/workflows/contract-check.yml` |
| Docs | `README.md`, `docs/api-contract.md`, `docs/data-format.md`, `docs/backend-handoff.md`, `docs/team-workflow.md`, archived v1 contracts/fixtures |

## Member 2 integration checklist

1. Keep UI routes/components in this same Next.js repository. The placeholder home
   page can be replaced. Do not create a second package or separate API server.
2. Import types/schemas from `@/types/...`. Keep Node libraries in route/server modules.
3. Upload FormData to `/api/transcript`, render every review reason, and allow manual
   correction and confirmation. Do not auto-submit courses to planning.
4. Build supported goal/track controls using `SUPPORTED_GOALS`. An undecided user
   should choose exploration. Require an ISO date or flexible deadline.
5. Post only confirmed course IDs and structured fields to `/api/plan`.
6. Initially use `/api/plan/mock` to build the dashboard; show DEMO visibly.
7. Render empty quarters, tentative eligibility, sources, warnings, and recommended
   milestone date ranges. Empty safe plans are expected until curated data arrives.
8. Handle `{error:{code,message,details?}}` for non-200 status codes.
9. AI toggles must be off by default and disclose external transmission before use.
   Never put transcript content or personal identifiers into goal notes/preferences.
10. Treat transcript state as sensitive, transient data. Do not send it to analytics,
    log it, or put it in browser localStorage. Clear upload/review state when done.

## Verification

Run `npm run check` for typecheck, unit/API tests, and canonical fixture/dataset
validation. Run `npm run build` separately. A real production build was served on
127.0.0.1:3100 and exercised with `scripts/smoke-api.ts`, including an in-memory
fictional PDF and runtime schema checks on actual HTTP responses. The production
PDF dependency was exercised, not just mocked. The latest automated suite contains 75 passing tests.

OpenAI network calls were tested with injected failures and structured fake
responses. No paid live OpenAI call or real transcript was used. The missing-key
path is fully functional. Neither sample course facts nor UW enrollment decisions
were independently verified.

## Privacy and operational limits

PDFs are not written to disk, uploaded externally, or retained by this application.
Only course-entry text is returned to the review client; headers are ignored by
heuristics rather than a guaranteed de-identification system. Private responses
use no-store. `.env.local`, credentials, keys, local tools, PDFs, transcripts, and
uploads are ignored by Git; never rely on filename patterns as a substitute for
reviewing files before a commit.

The API has upload/body/page limits but no public-production rate limiting or
isolated PDF worker pool. Deploying a public upload service would need resource
isolation, request timeouts, and abuse controls. The MVP is intended for controlled
hackathon use. No database/auth/account system was added.

The server loads JSON files from the repository's `data/` directory. Standard
`next start` from the repository is verified. A future standalone/container/serverless
package must explicitly include these files and the external PDF worker assets.
No hosting deployment has been performed.

## Remaining limits and next steps

1. Member 4 resolves remaining registration restrictions and later-term offerings before full real
   academic recommendations become useful. The current generated plan is intentionally partial.
2. Validate the heuristic parser against consented, de-identified UW transcript
   layouts; wrapped/multi-column layouts may need manual entry. No OCR is included.
3. Add a coordinated reviewed-grade contract if minimum-grade prerequisites must
   be automatically checked. Current course-ID-only inputs cannot substantiate grades.
4. Preferences currently personalize explanation selection; arbitrary scheduling
   constraints in prose are not automatically parsed or enforced. Add explicit fields
   and deterministic checks for any future supported hard constraint.
5. AI explanation is intentionally sentence selection, not unconstrained prose.
   Goal interpretation returns suggestions for user confirmation, not authoritative intent.
6. Degree completion, total credit coverage, seats, conflicts between meeting times,
   actual openings, and placement outcomes are outside this MVP.
7. Retrieval covers bundled data only; no live official pages are fetched. The
   committed embedding index (`data/index/embeddings.json`) must be refreshed with
   `npm run build:index` after data changes; `npm run build:index -- --check` reports
   stale chunks, which fall back to keyword ranking until refreshed.

Changes remain local. No commit or GitHub push is performed by this implementation.
