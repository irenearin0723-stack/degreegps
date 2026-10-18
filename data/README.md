# UniFlow data

## target_courses

Target-course records, prerequisite rules, Winter 2027 sections (with detailed registration rules for 90 reviewed sections), projected Spring/Summer offerings and the INFO offering inventory. Start with target_courses/README.md; REGISTRATION_MERGE.md explains the registration fields.

`registration_rules.json` is the registration evidence the backend loads (`lib/data.ts` → `lib/registration.ts`): all 115 sections, grade and concurrency rules, policies and restriction fixtures. On load it must agree with `courses.json`, `prerequisites.json` and `sections.json` (original section fields, and each reviewed section's `registration_rules` copy), or the API fails closed. When you update one, update the other.

## archive

Superseded data, kept for provenance and never loaded by the app. See archive/README.md.

## major_requirements

CS, AMATH and INFO degree requirements, course-to-requirement mappings, policy sources, documented issues and acceptance fixtures. Start with major_requirements/MAJOR_REQUIREMENTS_README.md. Validated by scripts, not yet used by the planner.

## career_paths.json

Skills, projects and actions for each goal type + track; used for career milestones.

Join the datasets by course_id. Course eligibility, term availability and degree-requirement membership are separate checks.
