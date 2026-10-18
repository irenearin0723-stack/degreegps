# Registration evidence handoff

Prepared from the existing Winter 2027 course dataset on October 17, 2026.

## Start here

Read registration_evidence_handoff.json. It packages the four grade-sensitive course rules, the INFO 340 concurrency exception and all 115 existing section evidence records. Thirty-two section records contain notes. Official source URLs, detail URLs, snapshot dates and input-file hashes are preserved. Existing course and section files have not been changed.

The user's pasted Codex report summary says its API cannot accept reviewed grades, concurrency is not connected to the planner and registration decisions are forced to unknown. The full missing-course-data.md file is not available on this machine. Its reported 1,378 checks have not been independently rerun here.

## Minimum grade rules

| Target course | Requirement |
|---|---|
| CSE 311 | One of CSE 123/CSE 143 AND one of MATH 126/MATH 135. Each selected prerequisite must have grade at least 2.0. |
| CSE 331 | One of CSE 123/CSE 143, grade at least 2.0. |
| INFO 340 | One of CSE 123/CSE 143/CSE 154/CSE 163 AND completed INFO 201 with grade at least 2.0. Only CSE 163 may be concurrent. |
| INFO 430 | One of INFO 330/CSE 414/I S 445, grade at least 2.0 in the selected alternative. |

The JSON preserves alternative branches exactly as recorded in prerequisites.json. Request reviewed prerequisite grades keyed by course_id. Missing grades remain unknown. A qualifying alternative is sufficient; a failing or unknown unused alternative must not override it.

## Existing section evidence to import

- CSE 351 A/B: recorded CSE major restriction. C/D: recorded ECE restriction.
- CSE 391 A: recorded CSE restriction. B: recorded ECE restriction plus concurrent registration in CSE 351.
- CSE 373 AH/AI/AJ: tentative sections excluded by default. The CSE 332 overlap note is a credit-review issue, not a direct major restriction.
- AMATH notes contain department policy references and conditional add-code waitlists. A policy link or Restr flag does not prove that an add code is required for this student now.
- Cross-list metadata, fees, tentative exam notes and open-status notes must remain distinguishable from hard registration requirements.

The notes are existing curated dataset evidence, not a claim that every sentence is a verbatim SLN note. Import them with their provenance. Do not research them again merely because they have not been connected to the planner.

## Implementation order

1. Accept reviewed grades and evaluate min_grades on the selected prerequisite branch.
2. Connect concurrent_allowed to the term planner. Preserve the separate CSE 391 B section corequisite.
3. Import section-level major restrictions and tentative-section exclusions, keyed by SLN and term.
4. Keep prerequisite satisfaction, section registration eligibility, term availability and schedule compatibility separate. Unknown registration does not erase a known prerequisite result.
5. Resolve detailed SLN rules and linked-component combinations only where evidence is still missing. INFO section data remains incomplete.

Run the acceptance checks in the JSON against the actual API/planner. None of those integration checks is claimed to have passed here. The local handoff checks confirm four grade-sensitive courses, one catalog concurrency exception, 115 preserved section records and 32 recorded-note entries.
