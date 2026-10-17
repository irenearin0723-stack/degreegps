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
  "use_ai_explanation": false
}
```

`major`: one nonempty label (maximum 200 characters). A combined major string is
accepted; it must match a verified dataset eligibility label or an explicit `*`
rule. The planner does not infer that every combined major qualifies for every course.
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
next approximate seasonal window and emits a warning. A past/current requested term is adjusted to the next future planning window with `START_TERM_ADJUSTED`; chronological quarter order is used. The horizon is exactly
three consecutive quarters, including summer. These windows are not UW term dates.

`use_ai_explanation`: defaults false; true explicitly permits external transmission
of goal/preferences and generated plan sentences for optional explanation selection.
A missing API key returns a local summary and `AI_UNAVAILABLE`, with HTTP 200.

### Response

HTTP 200: `PlanResponse`, even when no safe academic courses can be scheduled.
See `examples/plan-response.json` for a complete real-planner example and
`mocks/sample-plan.json` for a dashboard with illustrative coursework.

```json
{
  "schema_version": "2.0.0",
  "mode": "generated",
  "quarters": [
    {"term": "2027-winter", "courses": [], "notes": "Eligibility requires review."},
    {"term": "2027-spring", "courses": [], "notes": "Eligibility requires review."},
    {"term": "2027-summer", "courses": [], "notes": "Eligibility requires review."}
  ],
  "recommended_skills": ["Python", "Linear algebra", "Model evaluation"],
  "recommended_projects": ["Evaluate a baseline model on a public, non-sensitive dataset"]
}
```

The snippet omits required metadata, request echo, milestones, warnings, sources,
and summary for readability; use the complete JSON files or runtime schema.
Each course has `id`, `title`, nullable `credits`, `explanation`, `source_ids`, and
`scheduling_status`: `eligible` or `tentative`. Eligible means the recorded rules
were satisfied, not a reserved seat, an official degree recommendation, or a
promise of future availability. Dependencies on earlier planned quarters are
always tentative until prerequisites are actually completed.

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

Returns the canonical fictional Summer 2027 ML internship fixture (three quarters).
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
| `horizon_terms` | removed; three quarters fixed for MVP |
| `quarters[].id/year/term` | `quarters[].term` (combined ID) |
| `courses[].code/rationale` | `courses[].id/explanation` |
| milestone quarter/title/action_items | action, recommended date range, explanation |
| `sources[].retrieved_at` | `sources[].verified_at` (date or null) |

Do not send v1 request keys. Validate responses with `PlanResponseSchema` and import
`type PlanRequest` / `type PlanResponse` from `@/types/plan`. Keep the frontend and
backend in this same Next.js app and use relative `/api/...` URLs; no separate
backend origin or CORS configuration is needed for the MVP.

## Confirmed / projected / unknown offering update

The v2 frontend response shape and request fields are unchanged. Internal course
records now have exact-term `offering_evidence`. Only confirmed or projected
positive evidence can produce a recommendation. A confirmed record means presence
in a dated Time Schedule snapshot, not a seat guarantee. Projected recommendations
always use `scheduling_status: "tentative"`, explain that the offering is projected,
include `PROJECTED_OFFERING`, and cite the departmental projection in `source_ids`.
Unknown offering/prerequisite/grade information never becomes successful eligibility.

If registration eligibility is unknown but prerequisites and positive offering
are known, up to the remaining quarter capacity may be exposed as **review-only
candidates** through existing `quarters[].notes` and warnings with
`code: "COURSE_REVIEW_REQUIRED"`. These are not in `quarters[].courses`, cannot
satisfy later prerequisites, and must not be rendered as validated assignments.
Each warning includes its exact quarter, course ID, offering status, and source ID.
The current imported catalog still has unresolved eligibility, so its useful
three-quarter response is an adviser-review roadmap, not a confirmed registration plan.

Lecture/quiz times are not required for quarter-level planning. Specific section
selection, meeting conflicts, seat availability and add-code clearance are future
features. Known registration restrictions are still enforced; missing details
remain explicitly unknown. See `examples/projected-review-request.json` and
`docs/backend-projected-plan.json` for the full actual HTTP request/response.
