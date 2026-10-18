# Current imported dataset

The active data is `data/target_courses/courses.json` (64 array records), joined by
course ID to `prerequisites.json`; `career_paths.json` retains 21 recommended goal
paths. Original JSON/CSV/workbooks and source notes are preserved. Do not rewrite
the teammate's files into the old canonical format just to satisfy the loader.

`lib/course-import.ts` validates and adapts raw records into `CourseSchema`:

- `course_name` → `title`; team categories map to broad UI categories while
  `source_category` preserves the original label (not degree-audit membership).
- `any_of[].all_of` → `prerequisite_alternatives[].all_of` without flattening.
  Grade thresholds and branch-specific concurrency remain attached to each option.
- `checked_at` and official catalog/schedule URLs are preserved. `verified` here
  means human-curated catalog provenance; it is not complete enrollment clearance.
- `offered_term_ids` contains only `2027-winter` when listed, otherwise `[]`.
  `offered_terms: null` prevents an invented recurring offering pattern.
- `eligible_majors: null` and `enrollment_status: unknown` retain unresolved
  registration restrictions. Missing INFO section meetings remain `not_imported`
  as metadata, without blocking quarter-level review candidates.
- No degree-membership rule is silently reused as an enrollment restriction or
  permission. Major requirement files are integrity-checked, not a working DARS engine.

Run `npm run validate:data` for JSON/schema/metadata/reference diagnostics. For
CSV-to-JSON semantic parity and workbook structural checks, run
`python3 scripts/validate-data-artifacts.py`. Both write evidence under `docs/`.
The real loader fails closed on invalid data; it does not silently discard records
or substitute mock data. Existing canonical JSON envelopes remain a supported
legacy input format. The following section documents that format and career paths.

## Projected offering evidence

`target_courses/projected_offerings.json` contains 164 positive entries for existing
catalog records, with the official page URL, verification date, term, and content
hash of each fetched source. Source coverage is explicit: CSE and INFO pages cover
Autumn 2026/Winter 2027/Spring 2027; AMATH also covers Summer 2027. Blank or omitted
cells and courses outside the existing catalog are not invented as offerings.

`offering_evidence` on normalized courses separates `confirmed`, `projected`, and
`unknown` per exact term. Confirmed Time Schedule snapshots take precedence over
projections. `offeringForTerm` returns unknown for missing evidence; it never recycles
another year's listing. A positive entry requires a dated official HTTPS source.
`offered_term_ids` remains the legacy confirmed snapshot list, not the projection list.

For quarters without exact-term evidence, `offeringForTerm` falls back to the UW course
catalog "Offered:" pattern stored per course as `catalog_offering_pattern` (for example
`AWSp`; empty when the catalog publishes none, in which case a regular quarter is assumed).
That fallback is always `projected`, carries a note saying so, and never overrides an
explicit snapshot entry: a course absent from the Winter 2027 snapshot stays `unknown` for
that quarter.

Quarter-level planning ignores `section_data_status` as a time-scheduling gate, and
registration restrictions no longer block a course; they are disclosed in its explanation.
Prerequisite rules still apply. Courses implied by completed ones count as completed, and a
missing prerequisite grade plans the course as tentative rather than blocking it.

# Dataset handoff — Member 4

Edit `data/courses.json` and `data/career_paths.json`, then run `npm run check`.
The loader validates both JSON files every planning request. A missing or invalid
file returns `503 DATA_UNAVAILABLE`; it never substitutes invented verified data.
Course IDs must be unique after normalization. Do not put student data in datasets.

## Course records

The top-level shape is `{ "schema_version": "2.0.0", "description": "...", "courses": [...] }`.
`types/course.ts` is the exact schema. Each record requires every field below.

```json
{
  "course_id": "DEMO 300",
  "title": "Synthetic format example, not an actual UW course",
  "credits": null,
  "category": "major",
  "prerequisite_groups": [
    {"any_of": [
      {"course_id":"DEMO 100","minimum_grade":null,"concurrent_allowed":false},
      {"course_id":"DEMO 101","minimum_grade":null,"concurrent_allowed":false}
    ]},
    {"any_of": [
      {"course_id":"DEMO 200","minimum_grade":null,"concurrent_allowed":false}
    ]}
  ],
  "offered_terms": null,
  "eligible_majors": null,
  "source_url": null,
  "verified_at": null,
  "data_status": "sample",
  "tracks": ["ml", "data"],
  "foundation_priority": 5
}
```

This means `(DEMO 100 OR DEMO 101) AND DEMO 200`. Every group is required. Never
flatten OR alternatives into an AND list.

| Field | Meaning |
| --- | --- |
| `course_id` | Normalized department + three digits, optional course suffix |
| `credits` | Positive numeric credits or null if unknown |
| `category` | major, math, elective, general_education, other |
| `prerequisite_groups: null` | Prerequisites unknown; do not schedule |
| `prerequisite_groups: []` | Explicitly verified no course prerequisites |
| `minimum_grade` | Null if none; otherwise actual minimum on 0–4 scale |
| `concurrent_allowed` | True only when a verified rule explicitly allows concurrent enrollment |
| `offered_terms` | Nonempty list of winter/spring/summer/autumn, or null if unknown |
| `eligible_majors` | Exact permitted major labels, `['*']` for verified unrestricted enrollment, or null if unknown |
| `source_url` | Official HTTPS `washington.edu` / `uw.edu` URL (including subdomains), or null |
| `verified_at` | Real YYYY-MM-DD date of human verification, or null |
| `data_status` | verified, sample, unknown |
| `tracks` | Supported tracks this course plausibly helps prepare for |
| `foundation_priority` | 0–10 ranking weight curated by the team |

`verified` records require an official URL and verification date. A label alone is
not enough evidence: **a human must actually check every rule**, including major
eligibility and offerings. The code validates formatting and applies the stated
rules; it cannot independently authenticate the factual accuracy of curated data.
If any restriction cannot be represented faithfully, keep the affected field null
or mark the record unknown. Never erase a real restriction to make a plan look full.

The isolated `mocks/course-data.json` sample IDs resemble UW courses, but all their relationships and
offerings are synthetic. Do not relabel the bundled records verified without
replacing and checking the content against official documentation. No official
sources were verified for these sample records.

Current limitations of this representation:

- No standing, capacity, consent, program application, placement exams, or complex
  non-course admission restrictions. Mark major eligibility unknown when these
  matter and cannot be represented safely.
- Offered terms model a verified recurring pattern, not a section reservation or
  year-specific schedule. Sources must substantiate the pattern; actual quarterly
  availability always needs verification before registration.
- The prerequisite checker uses `reviewed_grades` when the request has them. Without a
  grade, the planner schedules the course as tentative and says it assumes the minimum
  grade; a reviewed grade below the minimum blocks the course. (Earlier MVP versions
  blocked every missing grade.)
- Verified concurrent rules are supported by the checker. The planner
  conservatively only uses prior completed/planned quarters; it does not solve
  co-requisite bundles within a quarter.
- A combined major request must match a curated eligibility label or an explicit
  unrestricted rule. No implicit dual-major entitlement is inferred.

## Career paths

Top level: `{ "schema_version": "2.0.0", "paths": [...] }`.
Each unique `(type, track)` has this format:

```json
{
  "type": "research",
  "track": "ml",
  "skills": ["Model evaluation", "Research communication"],
  "projects": ["Reproduce a baseline on a public dataset"],
  "actions": [
    "Identify research interests and check actual lab opportunities",
    "Read introductory papers and build foundations",
    "Prepare a small reproducible project and research resume",
    "Draft personalized professor outreach and track follow-ups"
  ],
  "data_status": "recommended"
}
```

Arrays must be nonempty; actions are ordered by priority. All bundled career
content is general recommended preparation, not sourced hiring requirements or
verified deadlines. Do not invent company dates, lab openings, or guaranteed
outcomes. The engine maps actions to a user-relative recommended date window.
Keep every supported goal/track combination populated (21 combinations).

## Retrieval corpus and index

`lib/rag-corpus.ts` derives one citable chunk per course, per course's lecture
sections, per requirement, program, option, policy issue and registration policy,
and per career path (marked unofficial) from the files in `CORPUS_FILES`. The
count grows with the data (1,160 chunks for the current 30-program import). Each
chunk keeps its source URL and verification date. Edit the source data, not the
chunks; avoid boilerplate repeated across records, because it matches every
query that uses those words.

`retrieveSources(query, filters?, options?)` in `lib/retrieval.ts` ranks chunks
with BM25 keywords plus boosts for:

- a named course code (`CSE 311`, `cse311`): that course's catalog record, then its sections;
- a named program ID or name (`CS`, `cs`, `Computer Science`): that program's records
  (IDs that are ordinary words, such as `INFO`, count only in capitals);
- "which courses/classes…" questions without a course code: course records.

When `options.use_embeddings` is set and `data/index/embeddings.json` exists, it
fuses keyword and embedding ranks (reciprocal-rank fusion). The corpus is rebuilt
automatically when any input file's modification time changes. Retrieval helps
explanation and source discovery; it must not override validated course rules.

`npm run build:index` (needs `OPENAI_API_KEY`) embeds only changed chunks;
`-- --check` exits nonzero when the index is missing or stale; `-- --rebuild`
re-embeds everything (required after changing `OPENAI_EMBEDDING_MODEL` or
`OPENAI_EMBEDDING_DIMENSIONS`). Stale entries are ignored at query time and
reported as `RETRIEVAL_INDEX_STALE`.

Tests: `tests/retrieval-ranking.test.ts` checks ranking mechanics on a small
fixed corpus and does not depend on `data/`. `tests/retrieval.test.ts` is the
quality check on the real data: question → accepted source IDs (any in the top
three passes). Add questions for new programs when importing data; if a re-import
renames a record, the test reports the missing ID.
