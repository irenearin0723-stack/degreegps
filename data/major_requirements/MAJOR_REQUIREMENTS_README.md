# UniFlow major requirements

Checked: 2026-10-17. Institution: University of Washington Seattle. Planning term: Winter 2027.

## Files

- major_requirements.json: authoritative structured package. Contains three standard program profiles, 32 requirement groups, course pools, two optional INFO profiles, sources and documented issues.
- requirement_groups.csv: one row per requirement group for manual review.
- requirement_course_map.csv: 267 course-to-rule candidate matches. This table does not allocate credits.
- ../target_courses/info_winter_inventory.json and .csv: 42 listed INFO course entries and three explicitly checked absent entries. Section counts include quizzes. SLNs identify sections but meeting times and prerequisites have not been imported.
- policy_sources.csv and policy_issues.json: provenance, version differences and exact coverage limits.
- requirements_test_cases.json: 12 backend acceptance fixtures. The file distinguishes executed data checks from application tests.
- UniFlow_Three_Majors.xlsx: human-readable review copy.

## Backend integration

1. Select the program profile after confirming the student's catalog year. The CS checklist is revision September 2023. AMATH and INFO are current page snapshots with no stated effective year.
2. Join course_id to ../target_courses/courses.json and ../target_courses/prerequisites.json. Match catalog prerequisites separately from degree membership. Many requirement candidates are outside the previous 20-course schedule sample.
3. Evaluate all_of, any_of, choose_courses, min_credits and min_gpa. Return needs_review for manual_review, incomplete pools, unknown grades, unknown approvals or unmatched profiles.
4. Allocate seven distinct CS core/capstone slots across allocation_group cs_seven_core_slots. Then sum unique eligible elective course credits toward 33, including allocated core courses. CSE 331 is fundamental and is excluded from this elective bucket.
5. For AMATH, check each two-course category and independently sum unique eligible electives to at least 27 credits.
6. For INFO, require grades of at least 2.0 in core courses and evaluate the complete capstone path. INFO 493 requires eight applicable credits, not just one registration. Confirm the exact 12-15 elective target and non-INFO approvals.
7. Apply Winter 2027 availability after requirement matching. not_listed means absent from the checked department snapshot. not_collected means schedule coverage is missing. They are different states. INFO inventory provides availability only; use actual section meetings, linked components and registration rules before generating a conflict-free timetable. Some INFO sections contain multiple meeting patterns in one listing.
8. Normalize approved joint-course aliases and transfer credits explicitly. Do not infer that INFO 290 automatically substitutes for INFO 280. Do not automatically double-count courses across majors.

## Scope and source decisions

The baseline includes standard CS, standard AMATH and standard Informatics. INFO Data Science and Biomedical and Health Informatics are separate optional profiles, disabled by default. AMATH Data Science, ACMS, Computer Engineering, honors, admissions workflows and full university residence requirements are outside this dataset. The CS senior elective and capstone candidate pools are partial. AMATH college general education is not encoded. This package supports course planning and cannot issue a complete graduation audit.

The current INFO General Catalog and Winter 2027 schedule use INFO 280 (four credits). A department page marked Autumn 2023 still lists INFO 290. The catalog snapshot is used for new planning, while personal substitutions remain subject to the student's approved degree audit.

Published credit ranges are descriptive, not a maximum allowed number of credits. Never add admission, core and general education totals without accounting for documented overlap. Unknown values are null. All source URLs and review dates are retained.

## Refresh

Recheck each official source before changing a profile. Record the new snapshot date and changed rule IDs. Refresh the actual Time Schedule separately from degree requirements. Preserve older profiles when requirements change.
