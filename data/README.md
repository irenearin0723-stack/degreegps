# UniFlow data

## target_courses

Target-course records, prerequisite rules, Winter 2027 sections (with detailed registration rules for 90 reviewed sections), projected Spring/Summer offerings and the INFO offering inventory. Start with target_courses/README.md; REGISTRATION_MERGE.md explains the registration fields. `registration_rules.json` is the consolidated registration evidence (all 115 sections, grade and concurrency rules, policies, restriction fixtures).

## handoff

Registration evidence handoffs. `registration_evidence_handoff.json` is what the backend currently loads (`lib/data.ts`); it pins SHA-256 hashes of `target_courses/{courses,prerequisites,sections}.json`, so update its `input_files` hashes whenever those files change. `winter_2027_registration_review.json` is the raw detailed SLN review that was merged into `target_courses/`. Each JSON has a companion `.md` explaining it.

## major_requirements

CS, AMATH and INFO degree requirements, course-to-requirement mappings, policy sources, documented issues and acceptance fixtures. Start with major_requirements/MAJOR_REQUIREMENTS_README.md. Validated by scripts, not yet used by the planner.

## career_paths.json

Skills, projects and actions for each goal type + track; used for career milestones.

Join the datasets by course_id. Course eligibility, term availability and degree-requirement membership are separate checks.
