# Free deployment verification — 2026-10-18

**Public production:** https://degreegps.vercel.app

Provider/workspace/project: Vercel **Hobby** / `gps-119d` / `degreegps`.
Deployment: `dpl_D4H1sAfxAQwLadNYVaYBxnjSJkFE`.
Immutable deployment URL: https://degreegps-ehnhowc4y-gps-119d.vercel.app
Dashboard: https://vercel.com/gps-119d/degreegps/D4H1sAfxAQwLadNYVaYBxnjSJkFE

The CLI queried the workspace's actual plan (`hobby`) before creating the project. The project has no Git integration and was deployed directly from the reviewed local workspace. No Git commit/push, paid subscription/trial/add-on, database, paid storage or purchased domain was created. Login occurred through the user's browser device-authorization flow; no token was pasted into the repository or logs.

## Actual checks

| Check | Result |
| --- | --- |
| `npm run check` | **152 passed, 0 failed**, plus TypeScript/data/mock contract checks |
| `npm run build:free` locally | PASS |
| Vercel cloud build | PASS; clean Linux `npm ci`, webpack compilation, TypeScript, all five Node API routes |
| Isolated function packaging (`npm run check:serverless`) | **5 API module checks passed**, no source-data fallback or node_modules symlink |
| Isolated bundle with a synthetic configured provider key + AI opt-in | **0 outbound fetches**; local real RAG/goal/plan fallback |
| Local production HTTP workflow | **7 checks passed** before adding the final two hosted-boundary checks |
| Local production browser audit | **8 scenarios completed, 0 failures, 0 runtime exceptions** |
| Public production HTTP (`verify:deployment`) | **9 checks passed, 0 failed**, no Vercel auth headers/cookies |
| Public production browser audit | **8 scenarios completed, 0 failures, 0 runtime exceptions, 0 bad page-resource responses** |
| Public static private-file paths | `/.env.local`, `/data/target_courses/courses.json`, `/data/index/embeddings.json` each return **404** |
| Hosted upload boundary | Synthetic PDF over 4 MiB returns structured **413 / FILE_TOO_LARGE** |

Public HTTP checks exercised actual HTML, real 8-quarter planning with course/career sources, plan-aware cited RAG, local goal interpretation with AI opt-in, genuine synthetic PDF extraction and confirmation, structured errors, goal/load regeneration, private-file paths and upload cap. Production requests asking for AI returned AI_DISABLED/local responses, rather than silently using a paid provider or mock plan.

The browser test used a new unauthenticated browser context, uploaded a synthetic PDF, confirmed grades, selected CS+AMATH/research, generated 8 quarters, used Ask, changed to SWE internship and a two-course cap, regenerated, tested demo-profile logout isolation, and checked 390px/360px layouts. It also intentionally reproduced the pre-existing acceptance of a nonexistent manual course ID. Its eight completed investigations are not a claim that every academic/UX behavior is defect-free. Existing academic and mobile badge limitations remain documented in [the project review](project-review-2026-10-18.md).

## Why packaging changes were necessary

The first isolated bundle test failed PDF extraction because Next.js tracing missed the dynamically loaded native canvas dependency. A normal local production run had access to the full node_modules folder and would not detect this. Added explicit native canvas, worker, CMap/standard-font/WASM traces. The isolated test then passed, and the public **Linux** production PDF endpoint also passed.

Approximate local trace sizes: Planner **15.9 MB**, Ask **15.9 MB**, Goal **15.8 MB**, Transcript **35.1 MB**, explicit mock route **14.8 MB**; all below the standard 250 MB function limit. Linux native binaries can differ in size. The actual Vercel cloud build and hosted PDF test, rather than only these local estimates, establish compatibility for this deployment.

Source upload dry-run reviewed **122 files / 14,159,128 bytes**, with credentials, env files except the empty template, .git, local tools/builds, raw PDFs, archive/workbooks/CSV and docs excluded. Provider keys were not uploaded. Runtime JSON assets stay server-side; public data URLs return 404. API responses still intentionally expose the data needed for the returned plan/citations.

## $0 behavior and scope

- Build/runtime free flags block external LLM and embedding requests even if a key is accidentally configured. Direct client construction also fails closed. The Ask UI defaults to local mode.
- Actual local keyword/extractive RAG and its references remain available. Live hybrid query embeddings and model-written explanations are disabled for this $0 demo, not misrepresented as tested free inference.
- Mock flags are fixed false in the hosted build. Normal user flows use real Planner/transcript/Ask APIs. The separately labeled mock endpoint remains for compatibility and was not substituted in the public user journey.
- Frontend and backend share the production domain, so no localhost API URL or additional CORS server is needed.
- This does not use a service that sleeps the entire app after 15 minutes idle. Functions can cold-start. Free quotas can still suspend usage when exhausted; unlimited uptime/traffic is not promised.
- The hosted upload cap is 4 MiB to stay below Vercel's 4.5 MB request limit including multipart overhead. Local non-free development retains 5 MiB. Larger inputs require a separate upload design or smaller PDF/manual entry, not a fake parser response.
- Existing academic planning limitations, demo-only login/localStorage and lack of hosted database were not changed or described as solved.

## Reproduce / redeploy

See [exact instructions](../deployment-free.md). Use `npm run build:free`, `npm run check:serverless`, then deploy the reviewed workspace with Vercel CLI under the Hobby owner. No Git push is necessary for this deployment method.

Public smoke command:

```sh
DEGREEGPS_SMOKE_ORIGIN=https://degreegps.vercel.app npm run verify:deployment
```

Netlify Free configuration is supplied only as a fallback; no Netlify deployment or paid plan was created or claimed tested.

Temporary local evidence: `/private/tmp/degreegps-free-check.log`, `/private/tmp/degreegps-free-build.log`, `/private/tmp/degreegps-free-bundle.log`, `/private/tmp/degreegps-public-http-final.log`, `/private/tmp/degreegps-public-browser-results.json` and screenshots. Private credentials are not included in this report.
