# Transcript parsing API proposal

**Status:** frontend integration proposal; not part of the frozen Plan API v1.0.0.

The frontend can demo transcript import locally. A real parser can replace the mock without changing UI components.

## Endpoint

`POST /api/transcript/parse` using `multipart/form-data` with one field named `transcript`.

Accepted frontend formats: PDF, PNG, JPG; maximum size 10 MB.

## Success response

```json
{
  "completed_courses": ["CSE 123", "MATH 126"],
  "in_progress_courses": ["CSE 311"],
  "detected_courses": [
    {
      "id": "det-1",
      "code": "CSE 123",
      "term": "Spring 2026",
      "grade": "3.8",
      "status": "completed",
      "confidence": 0.99
    }
  ],
  "warnings": ["Review every detected course before continuing."]
}
```

`status` is `completed`, `in_progress`, or `uncertain`. Confidence is between 0 and 1.

## Error response

Use the existing API error envelope:

```json
{ "error": { "code": "INVALID_REQUEST", "message": "Unsupported file type", "details": [] } }
```

## Privacy agreement to confirm

- Parse only after an explicit student upload.
- Do not log transcript contents or student identifiers.
- Delete the raw file immediately after parsing unless the student explicitly consents otherwise.
- Do not return name, student ID, address, or grades beyond what the course-review UI needs.
- Parsing is never final: the student confirms and can edit courses before `/api/plan` is called.
