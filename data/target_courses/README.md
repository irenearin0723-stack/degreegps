# UniFlow Winter 2027 Course Dataset

Institution: University of Washington, Seattle. Checked on October 17, 2026.

This package replaces the three-course format sample for Winter 2027 planning. All file content is English. The original sample is retained separately.

## Coverage

The dataset now contains 64 courses: 20 selected CSE/AMATH courses and 44 INFO courses. Sixteen CSE/AMATH and 42 INFO courses are listed for Winter 2027. INFO 443 and INFO 491 are not listed. INFO 290 is a legacy reference, not a current catalog course record. AMATH 353, AMATH 401, AMATH 481, and AMATH 483 have no entries in the inspected snapshot. This is a selected dataset, not the entire university schedule.

Sources:

- CSE Winter 2027 schedule: https://www.washington.edu/students/timeschd/WIN2027/cse.html
- AMATH Winter 2027 schedule: https://www.washington.edu/students/timeschd/WIN2027/appmath.html
- CSE catalog: https://www.washington.edu/students/crscat/cse.html
- AMATH catalog: https://www.washington.edu/students/crscat/appmath.html
- Restriction symbols: https://www.washington.edu/students/reg/tshelp/restr.html
- Meeting-time conventions: https://www.washington.edu/students/reg/tshelp/meetings.html

The schedules state that enrollment/status reflects their creation at 12:03 a.m. on October 17, 2026. Counts and status are snapshots, not live seat availability. Recheck before registration.

## Files

| File | Use |
|---|---|
| UniFlow_Winter_2027.xlsx | Editable workbook: Courses, Sections, and Prerequisites. Import into Google Sheets if desired. |
| courses.csv / courses.json | Sixty-four course records, term-specific listing status, planning labels, and sources. |
| sections.csv / sections.json | Listed lecture and quiz sections, SLNs, meeting times, instructors, visible flags, notes, and enrollment snapshots. |
| prerequisites.json | Course prerequisite expressions with alternative branches and numeric grade thresholds where stated. |
| prerequisites.csv | Tabular version of the prerequisite expressions. |
| test_cases.json | Twenty-two fictional verification examples for prerequisites, grades, listing status, tentative sections, and time overlap. |
| external_prerequisites.json | Referenced courses not yet included as schedulable records. |
| metadata.json | Coverage counts, time zone, snapshot date, source URLs, and shared limitations. |
| registration_rules.json | Consolidated registration evidence for all 1,240 sections (90 with detailed SLN Notes), grade rules, concurrency, general policies and reviewed restriction fixtures. |
| REGISTRATION_MERGE.md | Merge coverage, precedence and new fields. |

## Main fields

Course IDs contain spaces, such as `CSE 332`. CSV is UTF-8, comma-separated, with a header and quoted fields. JSON credits and enrollment counts are numbers.

`offering_status` is `listed` or `not_listed` for Winter 2027. `not_listed` means absent from the inspected department schedule snapshot, not permanently unavailable. Do not schedule those courses in this term by default.

287 records were added on 2026-10-17 for the expanded major profiles (281 from the first pass plus AMATH 342/403/422/423 and INFO 180/464, which rules name) (categories such as `stat_core`, `ece_choice`, `support_core`). Their titles, credits, descriptions and prerequisites come from the official course catalog. Their Winter 2027 `offering_status` and `lecture_sections` were read from the same 12:03 am October 17, 2026 Time Schedule snapshot in a user-authorized signed-in browser (170 listed, 111 not_listed). For the 170 listed courses, 980 sections (240 lectures, 502 quizzes, 238 labs) were parsed from that snapshot into sections.json/csv with meetings, rooms, instructors, enrollment/limit, flags, grading, codes and the schedule's notes (raw uppercase text); `additional_meetings` and `course_fee` appear only when listed, and `component` can now be `LB` (lab). The parser reproduced all 105 overlapping hand-built sections exactly. Matching `department_schedule_only` evidence was added to registration_rules.json; their detailed SLN Notes were not reviewed, so restrictions remain unknown. The schema also accepts `not_collected` for a course whose Time Schedule page was not checked, which is different from `not_listed`. Their prerequisites keep `original_text`; conditions that are not courses (placement or AP scores, permission, standing, recommendations) are listed in `verification_notes`. Catalog courses without a numeric credit value (variable `*` research courses and AP-only credit) are not records and are listed in external_prerequisites.json.

`credits` on a course is its catalog credit value; lecture credit values match in this batch. A quiz section has zero **additional** credits. Do not add course credits again for each quiz.

`category` and `skills` are team mappings based on catalog content, not official graduation-audit classifications or evidence of a student's proficiency. List fields in CSV use `|` separators. Paraphrased descriptions and prerequisite summaries preserve the checked facts; `original_text` is supplied only for the three original sample rules.

All meeting times are local to Seattle, `America/Los_Angeles`, and normalized to 24-hour `HH:mm`. Meeting days use `M`, `T`, `W`, `Th`, and `F`, separated by `|`. The UW source's early-afternoon times such as `130-220` are normalized to `13:30-14:20`. `TBA` rooms are retained; they do not mean online delivery.

Blank instructor fields mean the schedule does not name an instructor for that section. They are not copied from a lecture into quiz instructor fields.

## Prerequisite logic and backend change

The top-level JSON object is keyed by course ID. Any branch in `any_of` may satisfy the rule. All IDs in a branch's `all_of` must be completed.

**New compared with the initial sample:** some branches also have `min_grades`, an object mapping required course IDs to minimum grades. CSE 311 and CSE 331 require the recorded 2.0 thresholds. Do not ignore this field. If a required grade is not in the user input, return `needs_grade_confirmation`, not a successful eligibility decision.

CSV represents the same logic: rows within one `(course_id, alternative_group)` are AND; different alternative groups are OR. Blank minimum grades mean the catalog entry did not state a numeric threshold, not a zero grade requirement.

The sample API only provides `completed_courses`. The backend needs either additional grade input or an explicit warning when grade-dependent eligibility cannot be evaluated.

Do not count same-term courses as completed prerequisites without explicit permission. The special CSE 391 B concurrent requirement is a separate section-level rule: it does not generally authorize taking prerequisite courses concurrently.

External prerequisite IDs are recognized in a student's completed-course input, but must not be inserted into a generated schedule until their own course, prerequisite, and term records are collected. No transfer-equivalence or substitution rules were invented. In particular, do not automatically treat AMATH 352 as satisfying an explicit MATH 208 prerequisite.

## Registration rules and section handling

- `Restr` means a class, major, or college restriction exists. It does not by itself identify the permitted major.
- `>` means an add code is required. Tentative sections remain excluded by default.
- CSE 351 lecture sections A/B explicitly say CSE majors only; C/D explicitly say ECE majors only.
- CSE 391 A explicitly says CSE majors only. B explicitly says ECE majors only and concurrent enrollment in CSE 351 is required.
- CSE 373 is a non-major course. Quiz sections AH, AI, and AJ are tentative and will open only if needed. Its catalog records overlap with CSE 332; do not infer that both earn independent degree credit.
- CSE 332 AF/BD have a shared quiz note. `J` codes are retained as source metadata and must not be mistaken for a separate enrollment guarantee.
- AMATH 301 sections use Python and show a USD 22 course fee.
- AMATH restricted sections reference the department's add-code policy. This does not mean every flagged section always needs an add code.
- AMATH 402 and AMATH 482 list conditional add-code waitlists. Their URLs are retained in section notes.
- AMATH 482's heading says prerequisite cancellation is in effect. That concerns prerequisite enforcement, not cancellation of the class.

Quiz prefixes suggest a lecture group, but the reviewed section-detail Notes do not establish an exact permitted-pair whitelist. A planner must account for a lecture plus a compatible quiz when applicable. Do not use lecture-only time conflicts to claim a complete conflict-free schedule.

Tentative final-exam notes are retained as notes; they have not been independently confirmed. Some courses share an exam time in the displayed notes. Resolve exam conflicts before making a registration recommendation.

## Detailed registration review coverage

The initial connection failures were resolved. MyPlan and all detailed SLN Notes for 10 selected courses (90 sections) were read on October 17, 2026 with the user's authorization. The other 25 sections retain their prior department-schedule evidence. INFO section meetings and detailed SLN restrictions remain outside this review.

The reviewed courses are CSE 311, 312, 331, 332, 351, 373 and AMATH 301, 351, 352, 482. Detailed notes, source URLs and structured rules are merged into sections.json and sections.csv. Original notes, times, enrollment snapshots and identifiers are preserved. Registration status is not a live eligibility or seat guarantee.

registration_rules.json is the consolidated companion file: all 115 section evidence records, minimum-grade rules, INFO 340 concurrency, general policies, source registry, candidate lecture/quiz groups and restriction fixtures. Do not concatenate the earlier root handoffs as extra sections. Exact permitted lecture/quiz combinations remain unverified.

No personal student record was exported and no registration or waitlist submission was performed.

## Validation and next import step

The builder checks unique SLNs, course-to-section references, lecture/catalog credit agreement, time ordering, and fourteen expected example outcomes. The workbook was checked for readable layout and formula errors. These checks do not run the team's actual backend.

Backend integration should:

1. Read courses and join sections by course_id; filter the Winter 2027 listing status.
2. Exclude tentative sections unless explicitly included as provisional options.
3. Evaluate prerequisite branches and minimum grades; preserve unknown eligibility as a warning.
4. Apply the written section restrictions and CSE 391 B concurrent requirement.
5. Confirm lecture/quiz combinations and detailed registration rules before promising a valid registration plan.

This package contains Winter 2027 data only. Do not reuse its listing flags or section meetings for Spring, Summer, or Autumn 2027.

## Folder organization

This folder contains target-course data, prerequisites and Winter 2027 offering data. The additional info_winter_inventory.csv and info_winter_inventory.json files contain the INFO course availability index. INFO prerequisites are now included in prerequisites.json and prerequisites.csv. INFO section meeting times remain outside this dataset.

Degree requirements and course-to-requirement mappings are in ../major_requirements/.

## INFO course extension

Official catalog checked: https://www.washington.edu/students/crscat/info.html on October 17, 2026. Forty-four INFO records have been merged into courses.csv and courses.json, including the 42 listed Winter 2027 courses and the checked absent core choices INFO 443 and INFO 491. Existing CSE/AMATH course fields are preserved.

### Scheduling coverage

section_data_status is imported for every listed record and not_applicable for courses not listed. (Before 2026-10-17 the 42 listed INFO records were not_imported; their 143 sections, which match the INFO inventory SLNs exactly, are now in sections.json, and info_winter_inventory `meeting_data_status` is `imported`.) sections.csv and sections.json retain the original 115 CSE/AMATH records unchanged, with additive detailed registration evidence for 90 of them; the 1,125 sections added on 2026-10-17 carry department-schedule evidence only. A course fee stays in `other_codes` (e.g. `$22`), as in the original rows, and `component` can be `LEC`, `QZ`, `LB` (lab) or `SM` (seminar). Linked lecture/lab/quiz combinations are still not verified, so do not certify a conflict-free timetable from these records alone.

### Variable credits

credits is null for INFO 493, INFO 494, INFO 495, INFO 498 and INFO 499. credits_min and credits_max hold catalog bounds. Pick actual registered credits before calculating workload or degree progress. INFO 498 has catalog bounds of 1-5, while its checked Winter 2027 sections carry 3-5 credits.

### Prerequisites and concurrency

Each INFO course has a prerequisite expression. An empty all_of means no prerequisite is listed in the catalog, not unrestricted registration. Add codes, major restrictions and faculty approvals may still apply. INFO 410 recommends INFO 310 or equivalent; this recommendation is not encoded as a mandatory prerequisite. INFO 376 recommends Python familiarity.

The branch field concurrent_allowed permits same-term completion only for the named course. INFO 340 permits CSE 163 concurrently and separately requires a completed INFO 201 grade of at least 2.0. A backend that ignores concurrent_allowed must report needs_review for this case rather than silently deciding eligibility. The CSV concurrent_allowed column applies to its required_course_id row. An empty required_course_id row represents a course with no listed catalog prerequisite. INFO 490 is any three of four named courses, represented as four alternative branches.

INFO 340 and INFO 430 contain numeric grade thresholds. Missing grades require needs_grade_confirmation. Catalog overlap notes are retained in verification_notes; course overlap does not automatically establish substitution or double-counting approval. Categories and skills remain team planning labels.

Eight new INFO prerequisite examples were executed against a dataset helper. The original fourteen examples remain in test_cases.json; the team backend was not executed.

## Registration evidence merge

The October 17 detailed review supplements 90 of the 115 sections without replacing any existing field. New JSON fields are registration_detail_status, registration_status, registration_rules, registration_rules_summary, registration_notes, registration_source_url and registration_checked_at. CSV uses registration_rules_json for the structured rule array. Blank added CSV fields on the other 25 sections mean not reviewed in this batch, not unrestricted. The Excel Sections sheet provides readable summaries and the original detailed notes.

Apply each rule only within its section and stated period. AMATH 351/352/482 allow AMATH, CFRM and ACMS majors only in Period I (November 5-22, 2026, inclusive). AMATH 352/482 separately exclude graduate students. CSE 373 excludes C SCI and CMP E majors; AH/AI/AJ require add codes and are tentative. Institutional major-code mapping and student-specific facts must be supplied by the application. AMATH 301's captured Notes list no major restriction. Missing restrictions do not prove full eligibility.
