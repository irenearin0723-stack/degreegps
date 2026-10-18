# DegreeGPS backend validation — projected offerings update

Validated on 2026-10-17. **88 unit/integration tests and 31 actual HTTP checks passed; 0 failed.** TypeScript, dataset validation, all existing tests, mock contract validation, production build, the original HTTP smoke script, and 1,378 CSV/JSON/workbook integrity assertions passed.

**Result:** confirmed/projected/unknown offering evidence is implemented. Quarter-level recommendations no longer require section meeting times. The real CS + AMATH response now includes useful review candidates across Winter, Spring, and Summer 2027, with career milestones and sources. **It is still not a validated registration schedule:** all imported enrollment restrictions remain unresolved, so these candidates are explicitly outside `quarters[].courses`.

## Official sources checked

The three supplied pages were fetched and inspected directly; positive rows were extracted only for the existing 64 catalog courses. URLs, check date, source coverage and downloaded-page SHA-256 hashes are stored in `data/target_courses/projected_offerings.json`.

- [CSE 2026–2027 preliminary teaching schedule](https://courses.cs.washington.edu/courses/cse000/time-sched/teaching2026-2027.html): tentative Autumn/Winter/Spring schedule; no Summer column. Blank cells are not positive evidence.
- [AMATH 2026–2027 undergraduate schedule](https://amath.washington.edu/2026-27-amath-cfrm-undergraduate-course-schedule): includes Summer 2027; explicitly subject to change. Only existing AMATH catalog records were imported; no CFRM catalog/prerequisite records were invented.
- [Projected INFO schedule](https://ischool.uw.edu/programs/informatics/curriculum/course-schedules/info-projected): Autumn 2026, Winter 2027 and Spring 2027; explicitly subject to change. No Summer INFO offering was inferred.

The existing catalog and branch/grade rules were preserved. Reading the [AMATH registration policy](https://amath.washington.edu/advising) also confirmed that priority periods and section notes matter; that general policy was **not** treated as clearance of unknown individual restrictions.

## Effective evidence coverage

There are 164 positive departmental projection entries across the source-covered academic year. Existing confirmed Winter listing snapshots take precedence over a departmental projection of the same course/term.

| Term | Confirmed | Projected | Unknown |
| --- | ---: | ---: | ---: |
| 2027-winter | 58 | 0 | 6 |
| 2027-spring | 0 | 49 | 15 |
| 2027-summer | 0 | 5 | 59 |

All 64 real course records still pass import/schema validation; 0 rejected, 0 duplicate IDs. The 233 prerequisite alternatives, grade minima, explicit concurrency rules, 27 external prerequisite IDs, source categories and original source metadata are unchanged. Source verification here establishes departmental offering projections, not seats, advisor approval, or degree completion. Original course/section/prerequisite JSON, CSV and workbooks were not rewritten.

## Planning rules and frontend compatibility

- Internal `offering_evidence` separates `confirmed`, `projected`, and `unknown` for exact year/quarter identifiers. Missing evidence stays unknown; years and departments are not extrapolated.
- A positive record requires a dated official source. Confirmed is a Time Schedule listing snapshot, not live registration availability. Departmental imports cannot label themselves confirmed.
- With satisfied prerequisites **and verified matching eligibility**, confirmed offerings can be recommended; projected ones are always `scheduling_status: "tentative"`, with `PROJECTED_OFFERING`, an explanation and offering-source references. Unknown offerings stay blocked.
- Unknown prerequisite rules, missing grades and in-progress prerequisites stay blocked. Known major mismatches stay blocked. AI cannot change these decisions.
- Unknown registration restrictions are not cleared by an offering page. Prerequisite-satisfied candidates with positive evidence are separately ranked as **REVIEW ONLY** in existing `quarters[].notes` and `COURSE_REVIEW_REQUIRED` warnings. They are **not** in the validated course array, never enter the prior-planned prerequisite set, and never unlock dependent courses.
- Review candidates respect remaining quarter capacity, are not duplicated, and cite exact offering evidence. Projected review candidates explicitly say tentative/subject to change. They do not establish seats or permission.
- Missing lecture/quiz meeting times no longer block quarter-level recommendations or review candidates. Actual section compatibility, meeting conflicts, seat availability and add-code clearance remain future features; no conflict-free timetable is claimed.
- **The PlanRequest/PlanResponse v2 frontend JSON shape is unchanged.** Existing `scheduling_status`, `explanation`, `source_ids`, `notes`, warnings and sources carry the distinction. No frontend file was modified.

## Real CS + AMATH example

The synthetic student has completed programming/discrete/probability/data-structure foundations, MATH 125/126/207/208, and seeks an ML internship by 2027-06-01 with a two-course limit. Completed MATH 207 is important: later review candidates do not rely on assuming that earlier review-only AMATH coursework was completed.

| Quarter | Adviser-review candidates | Offering evidence |
| --- | --- | --- |
| 2027-winter | AMATH 351, AMATH 352 | confirmed listing snapshots |
| 2027-spring | AMATH 301, INFO 330 | projected — tentative |
| 2027-summer | AMATH 353, AMATH 383 | projected — tentative |

The actual production response has **six review-only candidates, zero validated assignments, and four ML internship preparation milestones**. Read [the complete actual PlanResponse](backend-projected-plan.json) and [its request](../examples/projected-review-request.json). This is now a useful adviser-review roadmap across all three quarters. A fully validated populated schedule still needs verified enrollment rules; the response deliberately does not pretend otherwise.

The original A–J scenarios also passed over actual HTTP. A less-prepared student may still receive fewer review candidates; missing prerequisites are not filled in to make a quarter look complete. Milestones retain recommended personal date ranges, deadline warnings and no outcome guarantees.

## Final execution results

| Check | Result |
| --- | --- |
| `npm run check` | PASS: TypeScript, imported-data validation, 88 tests, canonical mock contract |
| `npm run validate:data:artifacts` | PASS: 1,378 assertions, zero failures |
| `npm run build` | PASS: all four API endpoints compiled |
| `npm run verify:http` | PASS: 31 actual HTTP checks, zero failures |
| Original `scripts/smoke-api.ts` against final production build | PASS |
| Total unit/integration/HTTP tests | **119 passed / 0 failed**; original smoke overlap is not counted twice |

New regression tests cover projected/confirmed/unknown statuses, source/date requirements, confirmed precedence, exact-term/year boundaries, projected labels, unknown/missing prerequisites, missing grades, in-progress courses, major mismatches, review separation and no dependent-course unlocking, section-time independence, preservation of imported rules, and the realistic three-quarter review example. No safety test was disabled or skipped. Section-time assertions were updated to the user's explicit quarter-level scope; prerequisite and eligibility assertions remain enforced.

Detailed evidence: [data audit](backend-data-audit.json), [artifact checks](backend-data-artifacts.json), [HTTP results](backend-http-verification.json). The earlier pre-projection report is preserved [here](legacy/backend-validation-before-projections.md).

## Original Member 1 checklist

| Item | Status |
| --- | --- |
| 1. Next.js / TypeScript setup | PASS |
| 2. Shared request/response types | PASS |
| 3. Mock API | PASS |
| 4. Real course/career loading | PASS |
| 5. AND/OR prerequisite validation | PASS |
| 6. Three-quarter planning | PARTIAL: offering-aware engine and review roadmap work; validated real assignments await enrollment evidence |
| 7. SWE/ML skill matching | PASS |
| 8. Career/research milestones | PASS |
| 9. OpenAI interpretation/explanation | PARTIAL: structured/failure/no-key tests pass; no paid live evaluation authorized |
| 10. Errors/warnings | PASS |
| 11. Frontend-compatible API | PASS |
| 12. Tests/build | PASS |
| 13. RAG retrieval interface | PASS: typed placeholder |
| 14. Optional File Search | PARTIAL, optional and not a required blocker |

## Changed files and remaining limits

- `data/target_courses/projected_offerings.json`: official projection overlay.
- `types/course.ts`, new `lib/offerings.ts`, `lib/course-import.ts`, `lib/data.ts`: evidence schema, validated merge and lookup; catalog rules unchanged.
- `lib/planner.ts`: projected recommendation handling, source/warning labels, section-time independence, separate safe review candidates.
- `tests/offerings.test.ts`, `scripts/backend-scenarios.ts`, `scripts/validate-data.ts`, `scripts/verify-http.ts`: regression tests and evidence-aware validation/HTTP example.
- `README.md`, `docs/api-contract.md`, `docs/data-format.md`, `docs/backend-handoff.md`, this report and generated JSON/request/response evidence: handoff updates. No frontend/app route files changed.

Remaining blockers are explicit registration eligibility, reviewed grade input for minimum-grade courses, and eventual section registration checks. Course/degree credit allocation and optional File Search remain outside this change. General career recommendations do not establish real internship/RA openings.

No real transcript was used, no paid AI request was made, and no commit or push was performed. Temporary local validation servers were stopped after verification.
