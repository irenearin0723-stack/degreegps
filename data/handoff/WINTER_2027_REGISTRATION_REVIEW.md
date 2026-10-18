# Winter 2027 registration browser review

Reviewed October 17, 2026. Campus: Seattle. Version 2 supersedes this report's earlier unresolved SLN-detail statements. Supplement to REGISTRATION_HANDOFF.md and registration_evidence_handoff.json.

## Result

All 90 SLN detail Notes tables for the ten demo candidate courses were read in the user's authorized signed-in browser, after explicit approval of sdb.admin.uw.edu. MyPlan observations are retained alongside the detailed raw notes and structured restrictions in winter_2027_registration_review.json. No registration, course-plan change, waitlist submission or student-record export was performed.

## Verified section restrictions

| Course | SLNs checked | Detailed findings |
|---|---:|---|
| CSE 311 | 12 | Lectures A/B: C SCI,CMP E majors only. |
| CSE 312 | 14 | Lectures A/B and quizzes BA-BF: C SCI,CMP E majors only. AF/BF explicitly jointly offered. An open-for-registration note does not remove a major restriction. |
| CSE 331 | 10 | Lectures A/B: C SCI,CMP E majors only. |
| CSE 332 | 13 | Lectures A/B: C SCI,CMP E majors only. Quizzes AF/BD explicitly jointly offered. |
| CSE 351 | 22 | Lectures A/B: C SCI,CMP E majors only. C/D: E E,ECENG,ECE majors only. A/C and B/D are joint lectures; corresponding quiz counterparts are recorded individually. |
| CSE 373 | 11 | Lecture A explicitly excludes C SCI,CMP E majors. Quiz AH/AI/AJ require add codes and are tentative; exclude these three by default. |
| AMATH 301 | 3 | Notes list Python and a $22 additional fee. No major or graduate-level restriction appears in these captured Notes tables. |
| AMATH 351 | 2 | AMATH,CFRM,ACMS majors only during Period I, November 5-22, 2026. |
| AMATH 352 | 2 | Same Period I major filter; additionally No Grads. |
| AMATH 482 | 1 | Same Period I major filter; No Grads; prerequisite cancellation explicitly in effect. The waitlist is used only if registration is restricted by an add code. |

Each row's source URL is preserved per SLN in the JSON. Institutional major codes are reproduced as published and require an explicit mapping to the application's major model. Do not assume the application's CS label includes Computer Engineering. Period I restrictions do not establish a student's assigned registration start date.

The exact AMATH section notes list ACMS without a pathway qualifier. Prefer those section-specific notes over the department's broader priority summary. Do not impose this major filter on AMATH 301 from general policy alone. No Grads is a separate rule and does not expire with Period I.

## Winter 2027 registration phases

| Period | Inclusive dates | Additional context |
|---|---|---|
| I | November 5-22, 2026 | Continuing students have individual assigned dates; opening time is 6 a.m. on the assigned date. |
| II | November 23, 2026-January 3, 2027 | The periods page separately specifies 8:30 a.m. for newly admitted students. |
| III | January 4-10, 2027 | First seven calendar days of the quarter. |

Time zone: America/Los_Angeles. Sources: [UW calendar](https://www.washington.edu/students/reg/2627cal.html#Q5.2), [Registration periods](https://registrar.washington.edu/register/periods/).

The [AMATH advising page](https://amath.washington.edu/advising) contains an older calendar link and Autumn 2026 exceptions. Neither should replace Winter 2027 dates or exact SLN rules.

## Lecture and quiz combinations: remaining limitation

The [Registrar](https://registrar.washington.edu/register/errors/) requires registration in a lecture and its related lab/quiz together. However, the detailed Notes tables identify Quiz Section and joint offerings without establishing an exact permitted lecture/quiz SLN-pair whitelist. The [Time Schedule help](https://www.washington.edu/students/reg/tshelp/tshelp.html) also does not establish the target-course pairings.

The JSON retains letter-prefix groupings only as candidates, with lecture_quiz_pairing_verified set to false. Do not certify A + AA or any cross-group combination solely from its letters or joint-offering note. Joint counterparts are recorded explicitly, but are not permission to mix registration groups. AMATH courses in this subset list lecture sections only in MyPlan.

## Import instructions

1. Merge by term + campus + SLN. This supplement covers 90 of the original 115 section records, not every course in the 64-course inventory. INFO SLN details were not part of this review.
2. Import structured_rules with their section and period scope. Keep raw sln_detail.notes_text and source URLs for traceability. Detailed v2 restrictions supersede earlier unresolved-detail statements for these SLNs.
3. Retain catalog prerequisites and minimum grades from the earlier handoff, including INFO 340's explicit same-term CSE 163 exception. This review does not replace them.
4. Evaluate known restrictions separately from full eligibility. A failed known restriction can block a section; a passed restriction alone cannot certify eligibility. Missing student data and unverified linked components remain unknown.
5. Recheck availability and rules before registration. These are observations from October 17, not a live seat guarantee.

The [Registrar's course fundamentals](https://registrar.washington.edu/register/course-fundamentals/) require add codes for all courses from the eighth calendar day of the quarter. Apply that general rule separately from an early add-code indicator. Registration while a prerequisite is still in progress can be provisional and subject to cancellation; it does not imply same-term concurrency or a satisfied minimum grade.

## Validation

All 90 SLNs are unique and match the existing course and section identifiers. All have captured detailed Notes and source URLs. Joint-offering counterpart links were checked for reciprocity. Ten local restriction fixtures passed, including Period I boundary dates, Period II expiration of the AMATH major filter, missing major data, CSE 373 exclusions and the graduate restriction. These fixtures test data semantics, not the teammate's API or planner implementation. The existing sections.json file was unchanged.

Registration status remains unknown for every section until student-specific conditions, prerequisites, permissions, availability and exact linked components are evaluated. The SLN detail access issue is resolved; exact lecture/quiz pairing remains the substantive open evidence item.
