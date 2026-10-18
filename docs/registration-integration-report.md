# Registration eligibility backend integration

Implemented and verified on 2026-10-17 on `integration/backend-frontend`, based on the existing Member 4 handoff. No frontend UI, original course/prerequisite/section datasets, or handoff evidence was rewritten. No paid AI calls, commit, push, or branch change occurred.

## Result

Grade confirmation and exact-term concurrency are now connected to the actual planner/API. All 115 section evidence records are imported and evaluated at their own SLN/term scope. Known major/corequisite failures return ineligible; matching known conditions remain distinct from complete registration clearance. The API exposes prerequisite, registration, offering and schedule-conflict decisions independently.

**All 12 handoff acceptance checks pass both as automated unit/planner tests and against the actual production HTTP API.** Existing tests and HTTP scenarios also pass.

The handoff explicitly describes itself as existing evidence, not a fresh registration eligibility determination. Every section retains unresolved detailed SLN/component checks. Consequently **zero of the 64 real courses has fully verified registration eligibility**, and no real course is newly promoted into validated assignments. This is a remaining evidence limitation, not a failure to connect the supplied rules. Review candidates still work; no registration rule was invented to populate quarters.

## Current support verified before implementation

`lib/prerequisites.ts` already evaluated OR-of-AND branches, selected-alternative minimum grades and explicitly authorized concurrency correctly. Its implementation was preserved. Missing connections were: reviewed grades absent from PlanRequest, no grades/concurrent context passed by the planner, and section evidence unused by the loader. Transcript extraction already returned grades and required user confirmation; extraction remains separate from confirmation.

## Implemented rules

- **Reviewed grades:** optional numeric UW grades in 0–4 keyed by normalized course ID. Missing means unknown, never zero. Invalid IDs, duplicate normalized aliases, out-of-range/non-numeric values and grades for courses not confirmed completed are rejected. Thresholds are evaluated only in their own branches. A qualifying branch wins even when unused alternatives have low/missing grades.
- **CSE 311 / CSE 331 / INFO 340 / INFO 430:** existing grade thresholds are preserved without recollection or modification. Missing qualifying grade evidence retains `needs_grade_confirmation`.
- **Catalog concurrency:** `concurrent_courses` is explicitly keyed by exact academic term. INFO 340 may use concurrent CSE 163 only; INFO 201 must be completed with grade ≥2.0. Concurrent CSE 123 does not receive that exception. In-progress history alone is not a concurrent intention. Concurrent intentions never become completed history and are disclosed as conditional, unvalidated external intentions.
- **Section evidence:** 115 records joined to the original sections by term/SLN; all original metadata, including meeting fields, flags, fees, counts and notes, retained separately from interpreted rules. Curated notes are not labeled verbatim SLN text. Official schedule/detail URLs and snapshot timestamps are preserved. Source-file SHA-256 checks, prerequisite-rule comparison, duplicate keys and section-field checks fail closed on stale/inconsistent inputs.
- **CSE 351:** A/B retain the CSE-major filter; C/D retain ECE. One section's filter is not applied to all other sections or future terms.
- **CSE 391:** A has CSE filter without B's corequisite. B has ECE filter plus explicit concurrent CSE 351. Prior completion alone does not satisfy the concurrent-registration condition.
- **CSE 373:** AH/AI/AJ are excluded by default as tentative. Unselected tentative quizzes do not make every lecture/course option ineligible. Selecting an excluded quiz prevents a Winter review recommendation. The CSE 332 overlap note is not turned into an invented major restriction.
- **AMATH:** policy references/conditional waitlist URLs remain evidence; they never become an automatic “add code required” rule.
- **Major labels:** explicit aliases CS/CSE/Computer Science → CSE, ECE/Electrical and Computer Engineering → ECE; `+`-separated majors are matched individually. Unknown labels never receive implicit CSE/ECE permission.
- **SLN selection:** exact-term selected components are evaluated together. Unknown/wrong-term SLNs warn and cannot establish clearance. Winter section filters do not carry into Spring projections.

## Four independent decisions

Optional `academic_decisions` in PlanResponse reports each evaluated, unscheduled course/term. Completed, in-progress and already-planned targets retain existing exclusion behavior; this collection is not a full transcript or degree audit.

| Decision | Values / behavior |
| --- | --- |
| `catalog_prerequisite_status` | `met`, `unmet`, `needs_grade_confirmation`, `unknown`; separate conditional flag/reasons |
| `section_registration_status` | `eligible`, `ineligible`, `unknown`; known mismatches are ineligible, remaining handoff gaps stay unknown |
| `term_offering_status` | `confirmed`, `projected`, `unknown`; exact term, no extrapolation, no live seat claim |
| `schedule_conflict_status` | `not_evaluated`, with explicit quarter-only explanation; no conflict-free section timetable claimed |

Each section decision includes major status, corequisite status, tentative exclusion, remaining checks and source references. All references resolve in `sources`. Decision sources also include catalog and positive offering evidence even when a prerequisite fails, so one failed gate does not erase another known result.

Quarter-level planning does not require individual lecture/quiz times or a conflict-free timetable. Detailed linked-component **registration eligibility**, however, is explicitly unresolved in this handoff and is not dismissed as a mere meeting-time issue. Review candidates remain outside `quarters[].courses`, do not unlock later prerequisites, and retain projected/tentative labels. Existing canonical/mock planning behavior and all prior safety tests remain intact.

## Counts and interpretation

| Measure | Count / interpretation |
| --- | --- |
| Real courses loaded with verified catalog/prerequisite rules | **64** |
| Rules requiring numeric prerequisite grades | **4** |
| Helper met with synthetic qualifying completed prerequisites/grades | **64/64**; diagnostic only, not one realistic student's eligibility |
| Without reviewed grades in that diagnostic | **60 met / 4 needs_grade_confirmation** |
| Imported section records | **115**, with **32** nonempty curated notes |
| Section records with explicit major filter | **6** across CSE 351 and CSE 391 |
| Explicit section corequisite | **1**, CSE 391 B |
| Tentative exclusions | **3**, CSE 373 AH/AI/AJ |
| Courses with complete verified registration eligibility | **0** |
| Courses whose complete eligibility remains unresolved | **64**; a particular known mismatch may return ineligible for a supplied student/section |
| Real courses newly eligible for validated assignments | **0** under current evidence; candidates remain review-only |

“64 verified prerequisite rules” does not mean every student meets them. Request-specific statuses are computed from confirmed history, grades and explicit same-term intentions. “0 fully verified eligibility” does not mean all checks are unknown: known major/corequisite failures, satisfied catalog prerequisites and confirmed/projected offerings now return their independent results.

## Acceptance and verification results

| # | Handoff acceptance check | Unit/planner | Production HTTP |
| --- | --- | --- | --- |
| 1 | Missing reviewed grades for any potentially qualifying grade-dependent branch must not return met. | PASS | PASS |
| 2 | CSE 331 with CSE 123 grade 1.9 is unmet; grade 2.0 qualifies that branch. | PASS | PASS |
| 3 | INFO 430 may use INFO 330, CSE 414 or I S 445, with a grade of at least 2.0 in the selected alternative. | PASS | PASS |
| 4 | INFO 340 with completed INFO 201 grade 2.0 and concurrent CSE 163 meets catalog prerequisites. | PASS | PASS |
| 5 | Concurrent CSE 123 does not receive the CSE 163 concurrency exception. | PASS | PASS |
| 6 | INFO 340 still requires a qualifying completed INFO 201 grade when CSE 163 is concurrent. | PASS | PASS |
| 7 | An ECE-labelled CSE 351 section and a CSE-labelled section must keep separate major filters. | PASS | PASS |
| 8 | CSE 391 B requires concurrent CSE 351; do not apply that section-specific requirement to CSE 391 A. | PASS | PASS |
| 9 | Tentative CSE 373 quiz sections remain excluded by default. | PASS | PASS |
| 10 | An AMATH policy link alone does not prove that an add code is currently required. | PASS | PASS |
| 11 | Known prerequisite satisfaction must not overwrite an unknown registration decision. | PASS | PASS |
| 12 | Absence of a note is not evidence of unrestricted registration. | PASS | PASS |

Final verification:

- `npm run check`: **116 tests passed, zero failed** (96 existing plus 20 new), TypeScript, dataset validation and canonical mock contract passed.
- `npm run build`: production webpack build passed; all four API endpoints compiled.
- Existing HTTP regression script: **31 passed, zero failed**, including A–J planning, all four endpoints, malformed/missing input, synthetic PDFs, isolated missing-data 503 and no-key AI fallback.
- New `scripts/verify-registration-http.ts`: **12 acceptance groups passed, zero failed**, plus **three invalid grade requests correctly rejected with HTTP 400**. Every returned decision source reference was checked.
- Artifact validator: **1,378 passed, zero failed**, with temporary output redirection; JSON/CSV parity and both workbook structures verified. This is not live UW re-verification or full spreadsheet recalculation.
- `git diff --check`: passed. Frontend implementation files unchanged. Existing tests were not removed or weakened.

HTTP checks used the fresh production build on 127.0.0.1:3113, plus an isolated no-data server on 3114, both with `OPENAI_API_KEY=''`. The existing script's hardcoded ports were redirected via a temporary fetch preload without editing its checks. The new script accepts `DEGREEGPS_SMOKE_ORIGIN` (default 3113):

```sh
DEGREEGPS_SMOKE_ORIGIN=http://127.0.0.1:3113 node --import tsx scripts/verify-registration-http.ts
```

Local logs: `/private/tmp/degreegps-registration-check-final.log`, `/private/tmp/degreegps-registration-build.log`, `/private/tmp/degreegps-registration-artifacts.json`. No hosted deployment, browser UI additions or paid-provider behavior was evaluated in this change.

## Backward-compatible frontend contract additions

No existing required fields, v2 schema version or quarter/course shape changed. Old requests still work; old saved records and the frontend adapter may omit all new fields. The current UI therefore continues without supplying grades/concurrency/SLNs, and grade-sensitive courses conservatively remain blocked until a caller provides reviewed input. No parsed grade is automatically confirmed.

New optional request fields:

```json
{
  "reviewed_grades": { "INFO 201": 2.0 },
  "concurrent_courses": { "2027-winter": ["CSE 163"] },
  "selected_slns": { "2027-winter": ["12962"] }
}
```

This is a field-shape excerpt, not a complete request; SLN 12962 belongs to CSE 391 A and has its own CSE-major filter. Do not treat it as an INFO 340 section. `reviewed_grades` keys must refer to the request's confirmed `completed_courses`; optional values are never filled from transcript extraction. Term-keyed concurrency prevents an intention for one quarter from clearing three quarters automatically.

Complete synthetic INFO 340 prerequisite example:

```json
{
  "major": "Computer Science + Applied Mathematics",
  "completed_courses": ["INFO 201"],
  "in_progress_courses": [],
  "reviewed_grades": { "INFO 201": 2.0 },
  "concurrent_courses": { "2027-winter": ["CSE 163"] },
  "goal": { "type": "research", "track": "ml", "deadline": "2027-06-01" },
  "max_courses_per_term": 2,
  "start_term": "2027-winter",
  "use_ai_explanation": false
}
```

For INFO 340 in Winter, this yields catalog prerequisites `met` with conditional concurrency, registration `unknown`, offering `confirmed`, and schedule conflicts `not_evaluated`. It does **not** produce a validated INFO 340 assignment, because INFO section eligibility evidence is still missing. In-progress INFO 201 or missing/below-threshold grade still blocks the prerequisite route.

New optional response field: `academic_decisions`. It is preserved by the shared backend response schema; the existing UI adapter may ignore it. Detailed decisions require future frontend presentation work, intentionally outside this backend task. The source list also gains per-section schedule/detail references; these preserve provenance but can increase response/UI source-list size.

## Files modified or added by this integration

| File | Change |
| --- | --- |
| `types/plan.ts` | Optional reviewed grades, term-specific concurrency/SLNs, validation and optional independent response decisions |
| `types/registration.ts` (new) | Section/rule/evidence/decision schemas and types |
| `lib/registration.ts` (new) | Integrity-checked handoff import, major mapping, section and aggregate evaluation |
| `lib/data.ts` | Load/join all handoff sections alongside existing course/career data |
| `lib/planner.ts` | Supply grades/concurrency, evaluate section rules independently, retain safe review behavior and reference evidence |
| `lib/plan-service.ts` | Connect loaded sections to planner and expose decisions through real API |
| `tests/registration.test.ts` (new) | 12 handoff checks plus eight regression tests |
| `scripts/verify-registration-http.ts` (new) | Actual production HTTP acceptance checks and invalid-grade tests |
| `docs/registration-integration-report.md` (new) | This report and caller handoff |

`docs/REGISTRATION_HANDOFF.md`, `data/handoff/registration_evidence_handoff.json`, `docs/fullstack-audit.md` and `docs/missing-course-data.md` already existed as untracked local files before this implementation; they were not edited. Verification scripts' regenerated older JSON reports were restored to avoid mixing historical evidence with this report. No frontend UI, transcript extraction, prerequisite helper or original course/prerequisite/section files were changed.

## Remaining Member 4 verification and next integration boundary

- All 115 handoff records retain detailed SLN and compatible linked-component checks. Verify those for a narrow intended quarter/major path; record complete applicability and resolved/remaining conditions rather than simply removing unknown status.
- INFO still lacks imported detailed section restrictions; catalog prerequisites alone do not establish registration access. INFO 493/495 approvals and variable-credit arrangements remain unresolved as described in the course audit.
- AMATH Restr populations, priority periods and whether a conditional add code applies still need actual evidence. Blank restrictions on AMATH 301 are not affirmative unrestricted-access verification.
- Winter section facts cannot clear projected Spring/Summer sections. Existing exact-term offering projections remain usable tentative evidence, but are not registration permission or live seats.
- The handoff input hashes intentionally bind it to the current course/prerequisite/section snapshots. If those originals change, regenerate a consistent evidence handoff; otherwise real-data loading fails closed with 503. Future complete eligibility evidence needs a versioned schema/evaluator extension; the current handoff's unresolved checks must not be bypassed.
- A future frontend can collect confirmed grades and exact-term concurrent intentions and render `academic_decisions`; current backward-compatible defaults do not invent those user confirmations. Section timetable conflict detection remains a separate future feature.

The backend now uses the supplied known evidence, exposes what is met versus blocked versus unknown, and passes the handoff checks. A populated validated real course plan still requires complete registration evidence, not another prerequisite-engine rewrite.
