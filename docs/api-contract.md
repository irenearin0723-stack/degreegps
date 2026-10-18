# DegreeGPS API contract v2.0.0

`types/plan.ts`, `types/course.ts`, and `types/transcript.ts` are the canonical
shared types and Zod schemas. Do not maintain duplicate frontend types. Types
are inferred from schemas so runtime validation and TypeScript agree.

## POST /api/plan

Content-Type: `application/json`, maximum body 64 KiB, unknown keys rejected.

```json
{
  "major": "Computer Science + Applied Mathematics",
  "completed_courses": ["CSE 123", "MATH 126"],
  "in_progress_courses": [],
  "goal": {
    "type": "internship",
    "track": "ml",
    "deadline": "2027-06-01",
    "notes": "I want to practice evaluating models."
  },
  "max_courses_per_term": 2,
  "start_term": "2027-winter",
  "graduation_term": "2029-spring",
  "use_ai_explanation": false
}
```

`major`: one nonempty label (maximum 200 characters); combine majors with ` + `.
Each part is matched to a requirement profile in `data/major_requirements/` by program
name or UW institutional major code; one profile per major is used (the standard profile,
or for option-only majors the option matching `goal.track`). An unmatched major plans
over the whole catalog and emits `MAJOR_SCOPE_UNAVAILABLE`.
`completed_courses` (max 300) and `in_progress_courses` (max 30) contain IDs, not
transcript files or grades. Course IDs normalize spaces/case (`cse311` → `CSE 311`).
Duplicates and overlaps are errors after normalization. The client must confirm
extracted course history before planning.

`goal.type`: `internship | research | projects | explore`.
`goal.track`: `swe | ml | data | systems | hci | undecided`.
The undecided track is supported only with explore; all five focused tracks work
with every goal type. Unsupported combinations return 400. Deadline is a real
`YYYY-MM-DD` date or null (flexible); relative dates need user confirmation.
`goal.notes` and top-level `preferences` are optional text, each max 2000 characters.
They never change deterministic eligibility or hard constraints. AI may use these
preferences to choose the explanation focus when explicitly enabled; the current
MVP does not automatically interpret arbitrary academic constraints from prose.

`max_courses_per_term`: integer 1–5, limits NEW recommended courses. In-progress
courses are excluded and never automatically promoted to completed. The start
term should be a future planning quarter after the current enrollment period.
`start_term`: optional `YYYY-winter|spring|summer|autumn`; when omitted, uses the
next approximate seasonal window and emits a warning. A past/current requested term is adjusted to the next future planning window with `START_TERM_ADJUSTED`; chronological quarter order is used.
`graduation_term`: optional `YYYY-winter|spring|summer|autumn`. The plan covers every
autumn, winter and spring quarter from the start through graduation (summers are never
planned), at most 18 quarters (`PLAN_HORIZON_LIMITED` beyond that). Without it, three
regular quarters are planned. A graduation before the start emits `GRADUATION_BEFORE_START`.
These windows are not UW term dates.

`use_ai_explanation`: defaults false; true explicitly permits external transmission
of goal/preferences and generated plan sentences for optional explanation selection.
A missing API key returns a local summary and `AI_UNAVAILABLE`, with HTTP 200.

### Response

HTTP 200: `PlanResponse` with 1–18 `quarters`, even when no course can be scheduled.
See `examples/plan-response.json` for a complete real-planner example and
`mocks/sample-plan.json` for a dashboard with illustrative coursework.

```json
{
  "schema_version": "2.0.0",
  "mode": "generated",
  "quarters": [
    {"term": "2027-winter", "courses": [{"id": "CSE 311", "scheduling_status": "tentative", "explanation": "Planned for your major requirement \"Computing fundamentals\". ..."}], "notes": "..."},
    {"term": "2027-spring", "courses": ["..."], "notes": "..."},
    {"term": "2027-autumn", "courses": ["..."], "notes": "..."}
  ],
  "recommended_skills": ["Python", "Linear algebra", "Model evaluation"],
  "recommended_projects": ["Evaluate a baseline model on a public, non-sensitive dataset"]
}
```

The snippet omits required metadata, request echo, milestones, warnings, sources,
and summary for readability; use the complete JSON files or runtime schema.
Each course has `id`, `title`, nullable `credits`, `explanation`, `source_ids`, and
`scheduling_status`: `eligible` or `tentative`. Eligible means the prerequisites are
completed and the course is in the Winter 2027 snapshot; it is not a reserved seat or a
promise of availability. A course is tentative when it depends on an earlier planned
course, assumes a missing prerequisite grade, or relies on a projected or catalog-pattern
offering. Every explanation names the requirement the course serves (or the course it is a
prerequisite for) and its registration status.

Warnings contain `code`, `severity` (`info|warning|blocking`), `message`, and
`affected_course_codes`. They may identify blocked courses absent from quarters.
Sources include evidence for blocked candidates as well as selected courses, so even empty safe plans remain traceable. Sources contain `id`, `title`, nullable `url`, `kind`, `verified_at`, and
`data_status`. No synthetic URL is supplied for bundled sample data.

Milestones contain `action`, `explanation`, `associated_goal`, `related_course_ids`,
and `timeframe: {start, end, basis: "recommended"}`. These dates begin today and
adapt to the user's deadline; they are not actual hiring or lab deadlines.
Deadlines less than 42 days away (including past ones) trigger a feasibility warning
and prioritize the first three actions. Flexible goals use a recommended 180-day
window. Related course references express a preparation connection, not proven mastery.

## GET /api/plan/mock

Returns the canonical fictional Summer 2027 ML internship fixture (a static file with three
consecutive quarters, from before summers were skipped).
Always `mode: "mock"`, includes `UNVERIFIED_CATALOG`, and marks courses tentative.
This route does not call OpenAI or use user inputs. Render a visible DEMO label.

## POST /api/transcript

Send multipart/form-data with **exactly one `file` field**, filename ending `.pdf`,
MIME `application/pdf`, up to 5 MiB, up to 30 pages. The endpoint also checks the
PDF signature and caps the actual request stream (including missing Content-Length).
Do not set Content-Type yourself when using browser FormData; the browser adds
its multipart boundary.

```ts
import { TranscriptResponseSchema } from '@/types/transcript';
const form = new FormData();
form.set('file', pdfFile);
const response = await fetch('/api/transcript', { method: 'POST', body: form });
if (!response.ok) throw new Error((await response.json()).error.message);
const extraction = TranscriptResponseSchema.parse(await response.json());
// Show an editable review screen; do not auto-submit extracted history.
```

Complete fictional response: `examples/transcript-response.json`.
Records preserve course ID, title, term, grade, credits, status, repeated/transfer
flags, course-line text, and review reasons. A missing grade is ambiguous, never
assumed in-progress. Only explicit `IP` or `IN PROGRESS` counts as in-progress.
Numeric nonzero grades/CR/S are provisionally completed; minimum-grade eligibility
is a separate rule, never inferred from merely having a course ID.

Repeated attempts and transfer entries are withheld from the suggested completed
list until manually confirmed. Withdrawn/failed/ambiguous courses do not count.
Header/student identity lines are not intentionally returned. Course-entry text
is still sensitive: keep it in memory, do not log or persist it.

Every successful response has `needs_review: true` and
`user_confirmation_required: true`, including apparently clear records. Image-only
PDFs return 200 with empty records and `SCANNED_PDF_UNSUPPORTED`; the UI should
provide manual entry. Unsupported text layouts return `NO_RECOGNIZABLE_COURSES`
or ambiguous records. Damaged/encrypted PDFs return 422. OCR is not implemented.
No PDF bytes or extracted transcript text are sent to AI.

## POST /api/goal

```json
{"text":"ML research before 2027-06-01","use_ai":false}
```

Returns `{goal, clarification_required, warnings, mode}`. `goal` is null when an
unsupported/ambiguous request needs clarification. Local interpretation is a
minimal keyword matcher; it never pretends to understand all free text. AI is
optional (`use_ai: true` is explicit consent to send that text externally). The
user must review the interpreted structured fields. Relative dates are not guessed.

## POST /api/ask

```json
{"question":"Can informatics majors take CSE 312?","major":"INFO","official_only":false,"plan_course_ids":["CSE 311"],"use_ai":false}
```

Answers a planning question from the bundled data only (RAG over `data/`).
`question` is 3–500 characters; the other fields are optional. `major` (program
ID or name) narrows requirement/policy sources but never hides course records.
`plan_course_ids` only ranks related sources higher.

`plan` (optional) takes the same object as `POST /api/plan`. The server regenerates
that deterministic plan (no AI, no rate-limit cost) and adds "your plan" sources
(`kind: "plan"`, `official: false`, IDs `plan:overview`, `plan:quarter:<term>`,
`plan:course:<id>`) describing the inputs, each quarter, and why each evaluated
course was or was not scheduled. They are considered only for personal questions
("my", "I", "next quarter"…) or when the question names a course they describe, so
general policy questions still cite official records. Plan sources never contain
`reviewed_grades` values; grades only affect the regenerated plan. If the plan
cannot be regenerated, a `PLAN_CONTEXT_UNAVAILABLE` warning is returned and
catalog sources are used.

Returns `{schema_version:"1.0.0", mode, retrieval, answer, insufficient_evidence,
citations, sources, warnings, disclaimer}`. `sources[]` carries `id`, `kind`,
`document_title`, `content`, `source_url`, `section`, `verified_at`,
`effective_date`, `official`, and a relative `score`. Every `citations[]` entry is
a returned `sources[].id`.

- `use_ai: false` (default): local keyword ranking; `answer` is the top source
  verbatim (`mode: "deterministic"`). Nothing leaves the server.
- `use_ai: true`: the question and retrieved sources, including any plan sources (never transcripts or grades), are sent to the AI provider for
  query embedding (when `data/index/embeddings.json` exists) and answer
  generation. Answers mentioning a course code or date absent from the cited
  sources, or containing links, are rejected and replaced by the extractive
  answer with a warning.
- No matching source: `answer: null`, `insufficient_evidence: true`.

Answers explain bundled data; they never change plans or certify eligibility.

### Plan warnings for large catalogs

`/api/plan` plans only courses relevant to `major`: those named by the matching
requirement programs, every course in each program's home department (the prefix
its major rules name most often, e.g. CSE for Computer Science), and their
prerequisites. An info `MAJOR_SCOPE` warning states the counts; an unmatched major
returns `MAJOR_SCOPE_UNAVAILABLE` and considers the whole catalog. At most 10
per-course `COURSE_BLOCKED`/`NEEDS_GRADE_CONFIRMATION` warnings are returned, closest
to schedulable first; the rest are counted by reason in one info
`COURSE_BLOCKED_SUMMARY` whose `affected_course_codes` lists them. Every course's
reasons remain in `academic_decisions`.

### AI rate limits

`use_ai` on `/api/ask` and `/api/goal`, and `use_ai_explanation` on `/api/plan`,
share one budget (`lib/rate-limit.ts`). Defaults: 5 AI requests per client per
minute, 30 per client per day, 300 per deployment per day (about $0.30/day worst
case on `gemini-3.5-flash-lite`). Override with `AI_RATE_PER_MINUTE`,
`AI_RATE_PER_DAY`, `AI_RATE_GLOBAL_PER_DAY`. Requests without AI, or without a
configured key, consume nothing. Over the limit, the request still succeeds with
the local answer and an `AI_RATE_LIMITED` warning (a `warnings[]` string on
`/api/ask` and `/api/goal`; a plan warning on `/api/plan`). Counters are kept in
server memory, so they reset on restart and are per instance; the client key
comes from `X-Forwarded-For`, which is only trustworthy behind a proxy.

`use_ai_explanation` may also quote up to two official requirement/policy records
verbatim in `plan_summary`; each quoted record is added to `sources[]` with an ID
starting `retrieved:`.

## Errors and privacy

```json
{"error":{"code":"INVALID_REQUEST","message":"Check the request fields and supported goal combination.","details":["goal.track: select a supported focus"]}}
```

| Status | Examples |
| --- | --- |
| 400 | Invalid JSON, goal, duplicate course IDs, missing file, malformed multipart |
| 413 | File/body size or PDF page count limit exceeded |
| 415 | Wrong JSON/multipart content type or wrong file type |
| 422 | Invalid PDF signature, damaged/encrypted PDF, extraction failure |
| 503 | Missing/invalid course or career dataset |
| 500 | Unexpected planning/goal service failure |

All API responses use `Cache-Control: no-store`. Unknown internal errors do not
include raw exception text, student data, or secrets. A partial/impossible schedule
is a valid 200 plan with warnings, not a server error. Routes run on Node, not Edge.

## Frontend migration from v1

The old contract is preserved only for migration under `docs/legacy/`.

| Old field | v2 field |
| --- | --- |
| `majors` | `major` (one explicit label) |
| `target_role`, `target_summer` | `goal.type`, `goal.track`, `goal.deadline` |
| `start_year` + `start_term` | combined `start_term`, e.g. `2027-winter` |
| `horizon_terms` | `graduation_term` (plan through that quarter, summers skipped) |
| `quarters[].id/year/term` | `quarters[].term` (combined ID) |
| `courses[].code/rationale` | `courses[].id/explanation` |
| milestone quarter/title/action_items | action, recommended date range, explanation |
| `sources[].retrieved_at` | `sources[].verified_at` (date or null) |

Do not send v1 request keys. Validate responses with `PlanResponseSchema` and import
`type PlanRequest` / `type PlanResponse` from `@/types/plan`. Keep the frontend and
backend in this same Next.js app and use relative `/api/...` URLs; no separate
backend origin or CORS configuration is needed for the MVP.

## Offerings, registration and requirements

Internal course records have exact-term `offering_evidence`. For a quarter without it, the
UW course catalog "Offered:" pattern applies (`catalog_offering_pattern`), or a regular
quarter is assumed when the catalog publishes none; both are `projected` with a note saying
so. Only confirmed or projected evidence can produce a recommendation. A confirmed record means presence
in a dated Time Schedule snapshot, not a seat guarantee. Projected recommendations
always use `scheduling_status: "tentative"`, explain that the offering is projected,
include `PROJECTED_OFFERING`, and cite the departmental projection in `source_ids`.
Unknown offering or prerequisite information never becomes successful eligibility. A
missing prerequisite grade plans the course as tentative with a caveat; a reviewed grade
below the minimum blocks it.

Registration eligibility does not block planning (it is unknown for almost every section).
Each planned course states it instead: "Registration restrictions are not verified" or "A
recorded section restriction does not match your major". `academic_decisions` keeps the
per-section detail. The planner only schedules courses that advance an unmet major or
admission requirement of the matched profile, or the prerequisite chain of one, and reports
`REQUIREMENTS_REMAINING` or `REQUIREMENTS_COVERED` at the end. Quarters with nothing left to
plan say so in their notes.

Lecture/quiz times are not required for quarter-level planning. Specific section
selection, meeting conflicts, seat availability and add-code clearance are future
features. Known restrictions are disclosed on the course, and missing details remain
explicitly unknown. See `examples/projected-review-request.json` and
`docs/reports/backend-projected-plan.json` for the full actual HTTP request/response.
