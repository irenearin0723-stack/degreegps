# DegreeGPS backend validation — 2026-10-17

**Result: backend execution and safety checks pass; complete real academic scheduling remains PARTIAL because enrollment verification and multi-term offering evidence are incomplete.** No paid AI requests, real transcripts, frontend edits, commits, or pushes were made.

## 1. Executed results

| Verification | Passed | Failed | Evidence |
| --- | ---: | ---: | --- |
| Unit/integration tests (`npm test`) | 75 | 0 | Includes 22 supplied target-course fixtures and all A–J real-data scenarios |
| Actual production HTTP checks (`npm run verify:http`) | 30 | 0 | [Detailed checks and scenarios](backend-http-verification.json) |
| CSV/JSON, prerequisite, and XLSX integrity assertions | 1378 | 0 | [Artifact integrity results](backend-data-artifacts.json) |
| TypeScript, imported-data validation, mock contract validation | PASS | 0 | `npm run check` |
| Production build | PASS | 0 | `npm run build`: all four API routes compiled |
| Original live smoke script | PASS | 0 | `DEGREEGPS_TEST_ORIGIN=http://127.0.0.1:3101 node --import tsx scripts/smoke-api.ts` |

**Total: 105 unit/integration/HTTP tests passed, 0 failed**, plus 1,378 data-artifact assertions and the original smoke script. The original smoke script overlaps some HTTP cases and is not counted again. Initial baseline was 27 passing / 8 failing unit tests due to the replaced data paths and missing career data; final results above include fixes and expanded coverage.

No tests were disabled or skipped. The old sample-only warning assertion was updated to check unresolved real-data enrollment warnings; independent tests still enforce sample exclusion. A year-boundary test now uses a genuinely future start year, and an additional regression test checks adjustment of past/current starts.

## 2. Original Member 1 checklist

| # | Item | Status | Verified result / limit |
| --- | --- | --- | --- |
| 1 | Next.js / TypeScript setup | PASS | Next.js 16.4.2, local Node 22.23.3, strict TypeScript; build passed |
| 2 | Shared PlanRequest / PlanResponse | PASS | Canonical v2 Zod schemas/types; no breaking PlanRequest/PlanResponse field rename |
| 3 | Working Mock API | PASS | Actual GET returns labeled mock with illustrative courses; isolated mock rules cannot enter real plans |
| 4 | Real course and career loading | PASS | 64 imported course records plus 21 recommended career paths; missing/malformed data fails closed |
| 5 | AND/OR prerequisites | PASS | AND-of-OR legacy rules and exact OR-of-AND imports; grades/concurrency preserved; supplied fixtures run |
| 6 | Three-quarter academic planning | PARTIAL | Three sequential future quarters and safety logic pass; real quarters are empty because verification is incomplete |
| 7 | SWE / ML skill matching | PASS | Different curated skills and track-sensitive ranking tested, including nonempty synthetic algorithm fixtures |
| 8 | Career and Research milestones | PASS | Internship, RA/research, projects, exploration; goal changes and near deadlines exercised |
| 9 | OpenAI interpretation / explanation | PARTIAL | Missing key, network failure, structured fake responses and unsafe output rejection tested; no paid/live model call authorized |
| 10 | Errors and warnings | PASS | Actual 400/413/415/422/503 responses and safety warnings; no mock substitution on failure |
| 11 | Frontend-compatible real API | PASS | All four endpoints exercised; schemas/JSON validated; blocked candidate source references returned |
| 12 | Unit tests and production build | PASS | 75 tests, 30 HTTP checks, typecheck/data validation/build all passed |
| 13 | RAG retrieval interface | PASS | `retrieveSources(query, filters?)` exists with typed provenance fields; intentionally returns [] |
| 14 | Optional File Search | PARTIAL — optional | Not implemented; not a required blocker and no File Search calls were made |

The new major-requirement package is integrity-checked but is **not** a full degree-audit engine. Its 12 degree-credit/allocation acceptance fixtures are outside the original planner MVP and were not counted as executed backend tests.

## 3. Replaced-data audit

- **64 real course records; 64 valid after the explicit adapter; 0 rejected after import.** Raw import schema: 64/64. Direct compatibility with the former canonical course schema: 0/64; this was a schema mismatch, not invalid JSON.
- All **11 data JSON files** parse. No duplicate or unnormalized course IDs; 0 missing required raw fields; 0 unresolved course-title placeholders.
- Before adaptation, all 64 lacked the old names/fields `title`, `prerequisite_groups`, `offered_terms`, `eligible_majors`, `source_url`, `verified_at`, `data_status`, `tracks`, and `foundation_priority`. The adapter maps supplied facts, derives only labeled application ranking metadata, and leaves missing eligibility unknown.
- **64 prerequisite records / 233 OR branches** preserved exactly, including branch-local grades and concurrency. 27 external prerequisite IDs are recognized but never inserted into schedules. No dangling prerequisite references.
- Official catalog and schedule URLs plus checked dates are preserved for all 64 records. This audit independently reverified **0** academic policies or future schedules; valid URLs/dates establish provenance, not factual completeness or live seats.
- **58 Winter 2027 listings; 6 not listed:** AMATH 353, AMATH 401, AMATH 481, AMATH 483, INFO 443, INFO 491. Only `2027-winter` is recorded in `offered_term_ids`. No recurring offering pattern or Spring/Summer availability is invented.
- **64 excluded from confirmed scheduling due to incomplete enrollment verification.** This count overlaps other blockers: 42 listed INFO courses lack section meetings, and the six absent courses cannot be scheduled for Winter 2027. A visible Restr flag does not identify authorized majors; missing details are not interpreted as unrestricted registration. Even the absence of a visible AMATH 301 flag is not treated as a complete eligibility clearance.
- Categories are team planning labels, not official graduation-audit classifications. Each is explicitly mapped to the broad UI category and retained as `source_category`; unknown categories fail validation.
- Five variable-credit INFO records retain `credits: null`; no default registered credit value is invented.
- 115 section records, 0 duplicate SLNs, 0 orphan sections; metadata counts match. Seven CSV files were read. CSV/JSON mirrors, prerequisite branch rows/grades/concurrency, policy references, and two XLSX archives passed 1,378 checks. XLSX checks establish structural integrity and absence of stored error cells, not recalculated formulas or visual correctness.
- No placeholder course rows were found. The major-requirement package intentionally retains partial/example pools (`cs_capstone_examples`, `cs_senior_extra_sample`, `cs_elective_sample`) and five non-fully-verified requirement groups. These are not promoted to official degree completion claims. INFO 290 remains a legacy reference; no automatic INFO 280 substitution is made.

Detailed machine-readable counts: [backend-data-audit.json](backend-data-audit.json). The supplied raw data directories were not rewritten. They are currently untracked in Git, so Git cannot provide a committed old/new diff for these files; the preexisting uncommitted backend changes also remain intact.

## 4. A–J real-data scenarios

| Scenario | Input / purpose | Safety checks | Courses by quarter | Milestones |
| --- | --- | --- | --- | ---: |
| A | CS → SWE internship | PASS | 0, 0, 0 | 4 |
| B | CS + AMATH → ML internship | PASS | 0, 0, 0 | 4 |
| C | AI research assistant preparation | PASS | 0, 0, 0 | 4 |
| D | Missing prerequisites | PASS | 0, 0, 0 | 4 |
| E | Maximum two courses per quarter | PASS | 0, 0, 0 | 4 |
| F | Completed courses must not repeat | PASS | 0, 0, 0 | 4 |
| G | In-progress prerequisite is not completed | PASS | 0, 0, 0 | 4 |
| H | No feasible courses | PASS | 0, 0, 0 | 4 |
| I | Primary goal changed to ML research | PASS | 0, 0, 0 | 4 |
| J | Approaching internship deadline | PASS | 0, 0, 0 | 3 |

Each scenario ran both in the unit/integration suite and over actual HTTP. Assertions check response schema, real generated mode, confirmed request echo, sequential future quarters, no duplicated/completed/in-progress courses, load limits, prerequisite and exact-term rules for every selected course, recommended milestone ranges, matching goals/skills, and useful warnings/source evidence.

**All ten academic outputs are safe empty partial plans, not successful populated schedules.** Zero-course plans cannot demonstrate real-data prioritization or a nonempty real prerequisite chain; those behaviors are additionally tested using explicitly synthetic, authorized-rule fixtures. No synthetic fixture is presented as real UW scheduling evidence.

The persisted CS + AMATH → ML internship response has terms 2027-winter, 2027-spring, 2027-summer, four career milestones and 63 source references. Read the complete, schema-valid actual response in [backend-validation-plan.json](backend-validation-plan.json). It is a realistic **partial PlanResponse**; a populated fully verified real schedule is not possible from the currently available eligibility/term evidence.

## 5. HTTP and AI verification

- `POST /api/transcript`: actual synthetic text-based PDF succeeds; ambiguous records require review. Blank/image-only PDF gives a manual-review warning. Wrong file type, spoofed signature, damaged PDF, oversize upload, and missing file return structured errors. Unit tests also cover repeats, failures, withdrawals, transfer uncertainty, and page limits. PDFs were generated in memory, not saved or sent externally.
- `POST /api/goal`: local ML/RA and SWE goals work; invalid payloads are rejected and unsupported/ambiguous goals request clarification. AI opt-in with an empty key falls back locally.
- `POST /api/plan`: A–J real records return validated generated responses, distinct from mock. Invalid goals, overlapping history, malformed JSON, wrong content type, and oversize requests fail correctly. A second isolated production server without data returned `503 DATA_UNAVAILABLE`; shared data was not moved or renamed.
- `GET /api/plan/mock`: actual response stays explicitly mock with illustrative coursework and a different plan ID. Synthetic rules are now isolated in `mocks/course-data.json` for explicit mock generation as well.
- `OPENAI_API_KEY` is accessed only in `lib/ai.ts`, guarded by `server-only`. No key/provider SDK markers were found in the production browser JS bundles. Both HTTP servers ran with an explicitly empty key. Tests inject fake SDK HTTP responses/failures; no paid request was made.
- AI returns only validated goal fields or approved sentence IDs. Tests prove fabricated explanation IDs fall back, invented dates are not accepted, and course assignments are unchanged. Missing keys and network failures do not crash planning.
- All private API responses use no-store. No credentials or real student documents were printed or added.

## 6. Fixes and changed files in this verification

| Area | Files changed/created |
| --- | --- |
| Schema/import | `types/course.ts`, `lib/course-import.ts`, `lib/data.ts` |
| Rules/planning | `lib/prerequisites.ts`, `lib/planner.ts`, `lib/plan-service.ts` |
| Missing career data / isolated demo | restored `data/career_paths.json` (21 general recommended paths), new `mocks/course-data.json` |
| Tests | `tests/api.test.ts`, `tests/prerequisites.test.ts`, new `tests/imported-data.test.ts`, `tests/scenarios.test.ts` |
| Reproducible validation | `scripts/validate-data.ts`, `scripts/validate-data-artifacts.py`, `scripts/backend-scenarios.ts`, `scripts/verify-http.ts`, `package.json` |
| Docs / actual example outputs | `README.md`, `docs/api-contract.md`, `docs/data-format.md`, `docs/backend-handoff.md`, `examples/plan-response.json`, `examples/transcript-response.json` |
| Evidence | this report, `docs/backend-data-audit.json`, `docs/backend-data-artifacts.json`, `docs/backend-http-verification.json`, `docs/backend-validation-plan.json` |

Existing frontend/app route files and original teammate target-course/major-requirement JSON, CSV, and XLSX files were not edited. Course import errors fail closed, correlated branches are not flattened, and grade-dependent rules without reviewed grade evidence return `NEEDS_GRADE_CONFIRMATION`. Past/current starting quarters are adjusted using chronological order. Blocked courses now retain their source provenance instead of returning an unexplained empty schedule.

## 7. Integration readiness and blockers

**Frontend API integration: ready.** Member 2 can use the unchanged v2 plan/transcript contracts, explicit mock endpoint, real partial responses, structured errors, and goal-specific preparation. Render warnings and empty academic quarters; do not label empty or tentative outputs as a complete registration plan.

**Internship / RA roadmap: working.** Four preparation milestones (three for the near-deadline case), recommended skills/projects, and deadline feasibility warnings work without AI. These are preparation recommendations, not actual company/lab openings or guaranteed outcomes.

**Complete real three-quarter academic scheduling: blocked by data verification, not a failing build/API.** Required next data work is to resolve course/section-level enrollment restrictions, import INFO meeting/component details, and collect term-specific offerings for later quarters. Minimum-grade prerequisites also need confirmed grade input before eligibility can be certified; the current public request has course IDs only. Do not infer substitutions, dual-major credit approval, section compatibility, or degree completion from catalog presence.

Live AI evaluation and optional File Search remain untested/unimplemented respectively; neither blocks deterministic planning or frontend integration. RAG currently has an interface only. Full graduation-audit allocation is outside the implemented MVP.

## 8. Reproduce

```sh
cd /Users/a86137/Downloads/degreegps
export PATH="$PWD/.tools/node-v22.23.3-darwin-arm64/bin:$PATH"
npm run check
npm run validate:data:artifacts
NEXT_TELEMETRY_DISABLED=1 npm run build
```

`npm run verify:http` expects the production service at 127.0.0.1:3101 and a separate isolated service at 127.0.0.1:3102 with no data directory; run both with an empty `OPENAI_API_KEY`. It uses synthetic inputs only and refreshes HTTP evidence/partial-plan JSON. The existing `scripts/smoke-api.ts` can target a normal local service using `DEGREEGPS_TEST_ORIGIN`.

No changes have been committed or pushed. Temporary validation servers were stopped after verification.
