# DegreeGPS full-stack audit

Audit date: 2026-10-17. Branch: `integration/backend-frontend`. Audited commit: `27f1911` (clean working tree before verification).

## Executive summary

The integrated application runs, builds, and uses real backend responses by default. A new user can upload a synthetic text PDF, review course statuses, choose any of the four goal types, generate three future quarters, edit inputs, and regenerate. This is currently an **academic review and career preparation prototype**, not a validated registration-ready course planner.

The decisive limitation is eligibility: all 64 imported catalog records have unknown registration eligibility, and the importer hardcodes that status. The planner correctly blocks them from validated assignments. In the audited research workflow it returned **zero validated courses, four review candidates, and four career milestones**. Review candidates are text in notes/warnings, rather than a separate usable collection. Passing tests therefore do not establish that a student can obtain an eligible three-quarter course schedule from the current real dataset.

Main demo risks are unmarked example course history in real onboarding, inaccessible presentation of review-only results, hidden mobile mode labels, and a misleading demo-account interaction that copies a previous profile's plan to another profile. Fix these before claiming a complete personalized planner. Do not solve empty quarters by bypassing prerequisites or enrollment checks.

Only this report is an intended repository change. No implementation edits, commits, pushes, or branch changes were made. Verification scripts regenerated existing evidence files; those files were restored afterward.

## What was actually executed

All AI keys were disabled for the fresh audit servers. No paid AI requests were made. All transcripts, identities, and passwords used in testing were synthetic.

| Verification | Actual result | Scope / limits |
| --- | --- | --- |
| `npm run check` | PASS: TypeScript, data validation, **96/96 unit tests**, mock contract check | Current repository scripts, local Node 22.23.3 |
| `npm run validate:data:artifacts` | PASS: **1,378 assertions, zero failures** | CSV/JSON parity, prerequisite references/semantics, XLSX ZIP/XML integrity; not spreadsheet recalculation or a degree audit |
| `NEXT_TELEMETRY_DISABLED=1 OPENAI_API_KEY='' npm run build` | PASS | Production webpack build; four API routes emitted |
| Existing `scripts/verify-http.ts` | **31/31 PASS** | Fresh production server on 3111, isolated missing-data server on 3112; temporary fetch redirect replaced hardcoded test ports, no repository script edits |
| Existing Chrome workflow | **6/6 PASS** | Exact existing browser workflow with temporary origin substitution |
| Additional Chrome audit | **12/12 investigation checks completed** | Real PDF review, manual entry, all four goals, edit/regenerate, account behavior, blank PDF, injected network failure/retry, desktop/mobile measurements. Several checks intentionally reproduce defects; this is not 12 defect-free features |

The initial additional mobile test timed out waiting for the mode badge, which CSS hides on small screens. After waiting for the dashboard instead, the actual mobile workflow passed. This was a locator problem revealing a real labeling issue, not a failed API or browser crash.

Desktop: 1440×1000. Mobile workflow: 390×844; dashboard also checked at 360×800. No horizontal overflow at those sizes. Zero JavaScript runtime exceptions in the extended workflows. Console output included one deliberately injected failed network request and one unclassified 404 resource; the latter was not traced to a URL, so a completely clean console is not claimed.

Temporary logs and browser evidence are under `/private/tmp/degreegps-audit-*` and `/private/tmp/degreegps-fullstack-browser-results.json`. They are local audit artifacts, not portable project deliverables. Public hosting, live OpenAI behavior, real student PDFs, actual enrollment clearance, and every possible transcript layout were not tested.

## Implemented features and complete user journey

| Step / feature | Finding | Evidence |
| --- | --- | --- |
| Landing and onboarding | Works; major selection occurs before upload. Default profile is prepopulated without a clear sample label | `app/page.tsx:32`, `components/PlanForm.tsx:11` |
| PDF upload | Real multipart request; PDF-only, size checks, text extraction, explicit review | `components/TranscriptUpload.tsx:11`, `lib/transcript-api.ts:19`, `lib/transcript/parser.ts:75` |
| Review/edit transcript | Status changes, record removal, explicit confirmation, manual add/remove and duplicate rejection work. No inline course-code/grade correction | `components/TranscriptUpload.tsx:35`, `components/CourseInput.tsx:20` |
| Goal selection | Internship, Research/RA, Projects and Explore all generated real responses in Chrome; supported focus tracks and flexible/quarter deadlines work | `components/PlanForm.tsx:29`, `types/plan.ts:6` |
| Load selection | 2/3/4 control works; backend enforces course count. It is a total recommendation cap, not a distinct audited major-credit workload | `components/PlanForm.tsx:31`, `lib/planner.ts:55` |
| Three-quarter output | Three sequential future terms, no completed/in-progress duplicates; past requested start is adjusted | `lib/planner.ts:7`, `lib/planner.ts:54` |
| Validated vs review courses | Correctly separated by backend safety behavior; inadequately separated visually. Current real output has no validated courses | `lib/planner.ts:71`, `lib/planner.ts:86`, `components/PlanDashboard.tsx:28` |
| Warnings / official references | Present and clickable; too much undifferentiated detail before the roadmap | `components/PlanDashboard.tsx:27`, `components/PlanDashboard.tsx:29` |
| Career / research roadmap | Real curated milestones and recommended dates; not opening searches, guaranteed placements, or a transcript-based skill-gap assessment | `lib/career.ts:5` |
| Modify / regenerate | Edit goal and load, submit again, direct Regenerate all worked | `app/page.tsx:23`, `components/PlanDashboard.tsx:25` |
| Loading / failure / empty | Loading, explicit network error, retry and empty quarters work; transcript zero-record explanation is lost | `app/page.tsx:24`, `components/TranscriptUpload.tsx:51` |
| Save / account | Browser-only demo, visibly disclosed in modal/footer; no real authentication or progress updates. Cross-profile plan copying reproduced | `components/AccountModal.tsx:15`, `app/page.tsx:20` |

There are working landing, planner, dashboard, loading/error and demo-account views. No separate section timetable, real account service, degree-progress audit, or milestone completion editor exists. Account “Check my progress” opens the dashboard; it does not implement progress tracking. Login/save/open/logout were exercised. Account new-plan/back and every decorative interaction were not exhaustively clicked; their handlers were inspected.

## API integration and backend findings

| Endpoint | HTTP verification | Frontend integration |
| --- | --- | --- |
| `POST /api/transcript` | Success plus invalid/missing uploads and PDF error paths | Connected by `lib/transcript-api.ts:19`; global warnings/unmapped rows lost in presentation |
| `POST /api/goal` | Local interpretation and unsupported/ambiguous input paths work without a key | **Not called by current onboarding**; structured selectors construct the goal directly |
| `POST /api/plan` | Real validated dataset loader, success, invalid requests, missing-data 503 | Connected; validates response and echoed request, never silently substitutes mock (`lib/plan-api.ts:55–63`) |
| `GET /api/plan/mock` | Canonical fixture passes schema/cross-reference checks | Explicit build-time mock flag only; not part of the default real journey |

All four endpoints work over HTTP; that does not mean all four are integrated into the normal UI. The frontend v1 view model is explicitly adapted to the backend v2 schema. This adapter is functional but lossy: skills, projects and summary disappear, all course categories become `other`, and milestones become read-only cards with empty action-item arrays (`lib/plan-api.ts:32–49`).

The planner preserves OR-of-AND prerequisite branches, minimum-grade and concurrency conditions; in-progress courses never become completed just because time advances. Courses planned in earlier quarters are treated conditionally, rather than established earned credit. Unknown offerings and unknown registration rules remain blocked. Confirmed versus projected evidence is term-specific; projections remain tentative, and no seats are promised (`lib/prerequisites.ts`, `lib/offerings.ts`, `lib/planner.ts:57–93`). Individual lecture/quiz times are not required for quarter planning, appropriately.

The PDF parser is a bounded heuristic for text PDFs, with repeated-attempt/ambiguous-status review flags and no OCR. Recognized courses can be corrected through remove/manual entry; that is not robust support for arbitrary transcript formatting or transfer articulation. Parsed grades exist, but `PlanRequestSchema` accepts only completed/in-progress course IDs, so minimum-grade clearance cannot be supplied through the current planning contract (`types/plan.ts:23–37`). Conservatively blocking those conditions is correct.

AI keys are used server-side, structured goals can fall back locally, and explanation output is constrained to approved sentences rather than editable assignments (`lib/ai.ts`). The normal frontend sets `use_ai_explanation:false` and never calls goal interpretation (`lib/plan-api.ts:26`). Accordingly, the current demo must not claim that free-text AI drives planning. Live provider behavior was not tested. RAG retrieval is an empty interface, and optional File Search is absent; neither is required for this MVP.

## Dataset and academic accuracy limitations

The loader validates real data and merges official projected scheduling evidence; there is no silent mock fallback (`lib/data.ts:23`). Source URLs/check dates are retained. This audit checked stored evidence and imports, not a new live re-verification of every UW page.

- **64 schema-valid real catalog records; all 64 have unresolved enrollment eligibility.** `lib/course-import.ts:63` hardcodes `eligible_majors:null` and `enrollment_status:'unknown'`; adding verified eligibility data alone will not fix the importer.
- Prerequisites retain 233 alternative branches; 27 referenced prerequisite IDs are outside the selected catalog. Do not invent missing records to fill gaps.
- Stored offering coverage for the 64 records:

| Quarter | Confirmed | Projected | Unknown |
| --- | ---: | ---: | ---: |
| Winter 2027 | 58 | 0 | 6 |
| Spring 2027 | 0 | 49 | 15 |
| Summer 2027 | 0 | 5 | 59 |

The projection overlay contains 164 positive term entries across the covered academic year and three official departmental sources. Only five current records have Summer 2027 evidence; no CSE/INFO summer extrapolation is justified. Missing INFO section-time detail does not block quarter-level planning.

There are 32 major-requirement groups and 12 requirement acceptance fixtures in the data artifacts, but the planner does not perform degree-requirement allocation, double-counting resolution, graduation feasibility, or full CS+AMATH degree auditing. Artifact integrity checks do not execute these as a working degree engine. Course categories/ranking labels are application heuristics, not official requirement fulfillment.

## Ranked issues, fixes, ownership and effort

Effort: Small = localized change; Medium = coordinated implementation/verification; Large = new service or substantial evidence collection. Estimates exclude waiting for authoritative departmental answers. P0 entries are demo blockers or explicit scope gates; a truthful reduced demo can avoid the missing validated-course claim rather than fabricate eligibility.

| Rank / priority | Missing or broken; actual evidence | Recommended fix / acceptance criterion | Owner | Effort |
| --- | --- | --- | --- | --- |
| 1 / **P0** | Real onboarding starts with completed CSE 123/MATH 126 and in-progress CSE 311/CSE 351/INFO 201, without a sample-profile label (`components/PlanForm.tsx:11`). Reproduced in a fresh browser | Empty history by default; separate explicitly labeled synthetic example action. Generating without upload must never silently use another student's example history | Member 2, Member 3 | Small |
| 2 / **P0 scope gate** | No loaded real course can enter validated recommendations: importer forces unknown eligibility (`lib/course-import.ts:63`); audited schedule has zero validated assignments | Choose and label review-only MVP immediately. If demonstrating validated schedules, Member 4 must verify a small coherent prerequisite/eligibility chain, and Member 1 must load its evidence and support reviewed grades where necessary. Keep remaining unknowns blocked; test against real eligible records | Member 1, Member 4 | Medium–Large |
| 3 / **P0** | Review-only candidates live in unstructured notes/warnings (`lib/planner.ts:86`, `lib/plan-api.ts:31`). Research workflow: 75 warnings, 124 source entries, roadmap starts at 5,488px desktop; mobile example starts at 7,954px. Notes/warnings are 9px | Show concise status and candidate cards near the top, separately from validated assignments. Expose unresolved prerequisites/registration and relevant source links; group/collapse repetitive warnings. Add structured review fields additively if needed without breaking existing consumers | Member 2, Member 1, Member 3 | Medium |
| 4 / **P0** | Mode badge is hidden by `.dash-actions .mode-badge{display:none}` at ≤620px (`app/globals.css:11`). This also targets the mock badge. Transcript mock warning is returned but not rendered in review (`lib/transcript-api.ts:16`, `components/TranscriptUpload.tsx:51`) | Persistently display generated/review-only/demo status at every screen size. Render transcript demo warning before confirmation; keep both mock flags off in final real build. Verify explicit mock mode separately | Member 2, Member 3 | Small |
| 5 / **P0 for account demo** | Logout leaves in-memory plan; next login saves it to the new email (`app/page.tsx:20–22`). Synthetic profile B received A's plan ID. Password only checks length; modal does disclose demo status (`components/AccountModal.tsx:15–16`) | Simplest MVP: hide password/account flow and offer explicitly local anonymous save, or fix state isolation and keep conspicuous demo-only labeling. Never enter real credentials. Add regression for logout→different profile. Real authentication is optional outside the demo scope | Member 2; Member 1 if real auth chosen | Small–Medium; real auth Large |
| 6 / **P1** | Useful backend skill/project/summary fields are discarded (`lib/plan-api.ts:32–49`). API returned Python/linear algebra/model evaluation and a project; dashboard did not show them | Preserve and display recommended skills/projects and deterministic summary. Label suggestions; do not imply existing mastery | Member 2, Member 1 | Small–Medium |
| 7 / **P1** | Blank synthetic PDF returns `SCANNED_PDF_UNSUPPORTED`, but UI shows only “0 courses detected” and a disabled confirmation. Unmapped records are filtered out (`components/TranscriptUpload.tsx:28,51`, `lib/transcript-api.ts:28`) | Render global warnings in review, include manual-entry/reset path, retain unmapped rows as review items. Do not infer transfer equivalencies. Add blank/scanned and transfer-row UI regression | Member 2, Member 1 | Medium |
| 8 / **P1** | Notes and weekly hours are collected but do not affect deterministic milestones (`components/PlanForm.tsx:31`, `lib/career.ts:5–26`); AI goal route disconnected and explanation always off | For MVP, state structured goal/track/deadline determine the roadmap; hide or label unused personalization controls. Only wire optional AI with explicit opt-in/fallback and no assignment-editing capability | Member 1, Member 2 | Small for honest scope; Medium for wiring |
| 9 / **P1** | Milestone dates before the first planned term are clamped into the first quarter, action lists empty, status always not_started (`lib/plan-api.ts:44–47`). Audited four milestones cluster there; account progress cannot change | Show dated preparation separately from academic quarters, preserve actions, rename progress CTA if read-only. Do not spread dates artificially just to fill three columns | Member 2, Member 1, Member 3 | Medium |
| 10 / **P1** | No start-term selector; initial start is hardcoded Autumn 2026 (`components/PlanForm.tsx:11`). Calendar boundaries are approximate (`lib/plan-api.ts:19`, `lib/planner.ts:7`) | Show actual adjusted three-quarter horizon prominently; allow a supported future start. Keep deadline-boundary disclosure; use verified academic calendar dates only if claiming exact UW timing | Member 2, Member 1 | Small–Medium |
| 11 / **P1** | Multi-major UI joins majors as one string while eligibility checks exact-match that string (`lib/plan-api.ts:21`, `lib/planner.ts:69`). Currently masked by all-unknown eligibility | Before enabling verified restrictions, model student majors and restriction logic explicitly; add CS+AMATH tests against verified single-/dual-major policies. Never assume either-major permission from ambiguous text | Member 1, Member 4 | Medium |
| 12 / **P1** | Frontend manual normalization is narrower than shared schema (`components/CourseInput.tsx:14`); grade/code inline correction absent; grades cannot reach planner (`types/plan.ts:23`) | Reuse canonical normalization, support reviewed corrections and optional reviewed grade evidence with conservative validation. Maintain explicit confirmation and duplicate/conflict checks | Member 1, Member 2 | Medium |
| 13 / **P1** | Source count includes blocked candidates; 124 cards precede/follow sparse results, and adapter loses course categories (`components/PlanDashboard.tsx:24,29`, `lib/plan-api.ts:37`) | Label relevant evidence separately from catalog references; deduplicate display by source/term while preserving provenance. Preserve category metadata only where semantically supported; date-only check dates should avoid local timezone shifts | Member 2, Member 3, Member 1 | Small–Medium |
| 14 / **P1; P0 before public exposure with AI enabled** | No request rate/cost control around opt-in public AI routes; PDF byte/page limits exist but no isolated CPU/time budget (`lib/transcript/parser.ts:75`, `lib/ai.ts`, API routes) | For controlled demo keep AI key absent and use local fallback. Before public exposure add rate/concurrency limits and explicit AI access/cost control; verify PDF time/resource bounds on target host | Member 1 | Medium |
| 15 / **P1 release gate** | Local production works; no provider deployment was exercised. Push CI only covers main, not this branch unless a PR is opened (`.github/workflows/contract-check.yml:3–5`). Build trace includes local `data/.DS_Store` | Deploy a preview, verify PDF parsing/data availability/env flags over HTTPS, exclude machine artifacts from packaging, run browser smoke on preview. Add/trigger CI for integration work; do not claim a green remote check from local results | Member 1, Member 2 | Medium |
| 16 / **P1** | Existing passing tests miss unmarked defaults, candidate discoverability, hidden labels, cross-profile copying, and lost PDF warnings | Add a few meaningful browser regressions for these exact defects. Preserve existing academic-safety tests; do not loosen assertions to populate quarters | Member 2, Member 1 | Medium |
| 17 / **P2** | RAG interface returns empty results; optional File Search absent (`lib/retrieval.ts`) | Defer; keep optional architecture labels accurate | Member 1 | Medium |
| 18 / **P2** | No degree-audit engine, timetable editor, drag/drop, advanced optimization, real progress sync, additional-major coverage | Explicitly exclude from MVP. Build only after core evidence and UI issues are resolved | Members 1–4 | Large |

## Deployment and environment assessment

`npm run build` and local `next start` are verified. This is a Node/server deployment, not a static-export-only application. Course data files are included in the inspected plan-route build trace, so a missing-data packaging failure is **not** established. That same trace includes `data/.DS_Store`, a packaging hygiene issue. Hosted PDF worker/dependency behavior and provider resource limits remain unverified; local success does not prove those will fail or succeed remotely.

The server-only key handling and no-key behavior are good. Check public build-time flags (`NEXT_PUBLIC_USE_MOCK_DATA`, `NEXT_PUBLIC_USE_MOCK_TRANSCRIPT`, optional API base URL) on the final artifact. Do not put an OpenAI key in any `NEXT_PUBLIC_*` variable. Synthetic PDF and missing-data 503 were tested; public deployment, authentication service, persistent database and real account isolation were not implemented/verified.

## Ranked next-step checklist and team handoff

1. **Make inputs and output honest:** remove silent example history; keep generated/review/demo labels visible on mobile and desktop; explicitly choose review-only versus verified-course demo scope.
2. **Make current real results understandable:** candidate cards, concise blockers, readable text and grouped warnings; put the three-quarter roadmap before the catalog-wide detail. Preserve every safety exclusion.
3. **Resolve only a small verified academic path if needed:** collect authoritative enrollment/grade rules, update the importer/contract conservatively, and demonstrate those real records. If evidence cannot be obtained, keep the review-only scope.
4. **Finish useful career presentation and safe local state:** display existing skills/projects; preserve dates/actions; fix or remove cross-profile account saving; surface transcript failure guidance.
5. **Rehearse the exact final build:** targeted browser regressions, production checks and a hosted preview smoke test with both mock flags off. Verify complete journey, mobile status labels and empty/error recovery.

**Member 1 — Backend:** next implement an evidence-aware eligibility import path and reviewed-grade input only where authoritative rules exist, with Member 4. Offer structured review candidates additively, preserve no-key fallback, and help expose existing career fields. Fix multi-major semantics before enabling restrictions. Own production/API/PDF preview verification and public AI controls if enabled. Do not start File Search first.

**Member 2 — Frontend:** next remove default sample history; show review candidates and mode labels clearly; collapse noisy warnings and display skills/projects. Render PDF warnings/unmapped rows; fix logout/profile state or remove account flow. Verify edit/regenerate/retry on desktop/mobile and add focused UI regression coverage. Do not present review candidates as validated assignments.

**Member 3 — Design:** define a clear legend for validated eligibility, tentative projected offering and unresolved review; prioritize a readable one-screen result summary and candidate cards. Simplify source/warning hierarchy, keep labels visible on phones, and remove misleading account/progress language. Review the exact demo screenshots with Member 2.

**Member 4 — Data:** verify a narrow CS+AMATH chain, including enrollment restrictions, grade thresholds, prerequisite alternatives and exact-term offering evidence. Record official URLs/check dates and leave unresolved fields unknown. Explicitly state Summer coverage gaps. Do not expand to more majors or claim official degree completion before the existing path is verified.

## Recommended minimal final-demo scope

Use a visibly labeled synthetic student and a synthetic text PDF, with real parsing and real `/api/plan` responses. Show status review, manual correction, a CS+AMATH structured goal, a supported deadline/load, three future terms, review-only academic candidates with official evidence and unresolved restrictions, and curated internship/RA preparation actions. Change the goal and regenerate to demonstrate actual behavior. Keep mock flags off and AI disabled; describe the deterministic engine and optional AI interface accurately.

If verified eligible records become available, show those separately from review-only options and keep projected offerings tentative. Otherwise explicitly say **“planning assistant with academic options requiring advisor/registration review”**, not “validated course schedule.” Do not claim seats, official degree approval, AI personalization from free text, actual job openings, production login or progress tracking. Hide the account feature until its state bug is fixed; a database/auth system is not necessary for this scoped demo.

## Direct answers for the team

- **Can a new user complete the whole workflow now?** They can finish the real upload→review→structured goal→three-quarter response→edit/regenerate flow. They cannot obtain a genuinely eligibility-validated course schedule from the current imported dataset. Several important review/error details are poorly exposed.
- **Can we demo without fake results?** Yes: use openly synthetic inputs and real API outputs, honestly show review candidates and curated career suggestions. Do not substitute mock courses for the empty validated quarters. Fix the labeling/presentation P0s first.
- **Top five things to finish?** Honest inputs/mode labels; readable separate review candidates; verified eligibility evidence or explicit review-only scope; useful career/PDF presentation plus safe account state; preview deployment and regression rehearsal. See the ranked checklist for execution order.
- **What exactly should Member 1 do next?** Work with Member 4 on a small evidence-backed eligibility/grade path and additive structured review results; preserve safety checks. Then verify deployment/API/PDF behavior and expose existing career output. AI/RAG expansion can wait.
- **What exactly should Member 2 do next?** Clear unlabeled defaults, keep mode labels visible, render review candidates above grouped warnings, and show existing skills/projects; then fix transcript warning and logout state regressions.
- **Ready to deploy?** Ready to attempt a controlled preview with AI disabled; **not yet verified for public release**. The local production build passes. Hosted data/PDF behavior, public request controls and final environment flags still need verification.
- **Ready for judging?** **Not yet as a complete validated academic planner.** After the P0 labeling/state/presentation fixes, a tightly scoped and honest review-assistant demo is viable. A validated-course-planner claim additionally requires verified enrollment/grade evidence and an end-to-end example using it.
