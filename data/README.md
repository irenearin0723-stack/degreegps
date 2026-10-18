# UniFlow data

## target_courses

Target-course records, prerequisite rules, Winter 2027 sections (with detailed registration rules for 90 reviewed sections), projected Spring/Summer offerings and the INFO offering inventory. Start with target_courses/README.md; REGISTRATION_MERGE.md explains the registration fields.

`registration_rules.json` is the registration evidence the backend loads (`lib/data.ts` → `lib/registration.ts`): all 115 sections, grade and concurrency rules, policies and restriction fixtures. On load it must agree with `courses.json`, `prerequisites.json` and `sections.json` (original section fields, and each reviewed section's `registration_rules` copy), or the API fails closed. When you update one, update the other.

## archive

Superseded data, kept for provenance and never loaded by the app. See archive/README.md.

## major_requirements

`program_catalog.json`: every UW Seattle undergraduate major from the official General Catalog (112 majors), with requirement text and links to encoded profiles. `major_requirements.json`: encoded requirement profiles for 14 majors (CS, AMATH, INFO, Computer Engineering, ACMS, Statistics, Mathematics, ECE, HCDE, ISE, Physics, Economics, ME, A&A, with their options), course-to-requirement mappings, policy sources, documented issues and acceptance fixtures. Start with major_requirements/MAJOR_REQUIREMENTS_README.md. Validated by scripts, not yet used by the planner.

`target_courses/courses.json` also holds 281 course records (2026-10-17) for courses those profiles require or offer as a short choice, from the official course catalog. Their Winter 2027 `offering_status` is `not_collected` because the Time Schedule requires UW NetID sign-in, so the planner never treats them as offered.

## career_paths.json

Skills, projects and actions for each goal type + track; used for career milestones.

Join the datasets by course_id. Course eligibility, term availability and degree-requirement membership are separate checks.
