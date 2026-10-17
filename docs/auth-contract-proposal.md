# Authentication and saved progress proposal

The current frontend uses a clearly labeled browser-local demo account. It never stores the password. Production must replace this adapter with server-side authentication before storing real student records or transcripts.

Recommended backend endpoints:

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/me
GET  /api/me/plans
POST /api/me/plans
GET  /api/me/plans/:plan_id
PATCH /api/me/milestones/:milestone_id
```

Use an HTTP-only, Secure, SameSite cookie for the session. A saved plan should include `user_id`, `plan_id`, `schema_version`, `created_at`, `updated_at`, and the validated plan response. Milestone progress should be stored separately so regenerating a plan does not silently erase completed work.

Transcript files and extracted records are sensitive student data. Do not put them in browser storage. Define retention and deletion behavior before enabling authenticated uploads.
