# UniFlow data

## target_courses

Target-course records, prerequisite rules, Winter 2027 sections (with detailed registration rules for 90 reviewed sections), projected Spring/Summer offerings and the INFO offering inventory. Start with target_courses/README.md; REGISTRATION_MERGE.md explains the registration fields.

`registration_rules.json` is the registration evidence the backend loads (`lib/data.ts` → `lib/registration.ts`): all 1,240 Winter 2027 sections (90 with detailed SLN Notes reviewed, the rest department-schedule evidence only), grade and concurrency rules, policies and restriction fixtures. On load it must agree with `courses.json`, `prerequisites.json` and `sections.json` (original section fields, and each reviewed section's `registration_rules` copy), or the API fails closed. When you update one, update the other.

## archive

Superseded data, kept for provenance and never loaded by the app. See archive/README.md.

## major_requirements

`program_catalog.json`: every UW Seattle undergraduate major from the official General Catalog (112 majors), with requirement text and links to encoded profiles. `major_requirements.json`: encoded requirement profiles for 14 majors (CS, AMATH, INFO, Computer Engineering, ACMS, Statistics, Mathematics, ECE, HCDE, ISE, Physics, Economics, ME, A&A, with their options), course-to-requirement mappings, policy sources, documented issues and acceptance fixtures. Start with major_requirements/MAJOR_REQUIREMENTS_README.md. Validated by scripts; the planner uses the major and admission rules of the matched profile (see lib/major-scope.ts and lib/requirements-progress.ts).

`target_courses/courses.json` holds 351 courses: the original 64 plus 287 added on 2026-10-17 for courses those profiles require or offer as a short choice, from the official course catalog. Winter 2027 listing status comes from the 12:03 am October 17, 2026 Time Schedule snapshot (230 listed, 121 not listed), and every listed course has its sections in sections.json (1,240 in total: meetings, rooms, instructors, enrollment snapshot, notes). Each course also stores the catalog's typical offering pattern (`catalog_offering_pattern`), which the planner uses for quarters without schedule data.

## career_paths.json

Skills, projects and actions for each goal type + track; used for career milestones.

Join the datasets by course_id. Course eligibility, term availability and degree-requirement membership are separate checks.
