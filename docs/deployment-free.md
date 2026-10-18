# DegreeGPS: strict $0 deployment

Public production URL: **https://degreegps.vercel.app**.

Provider: **Vercel Hobby**, personal student/non-commercial demo. Free alternative: **Netlify Free**, not a trial. Checked 2026-10-18. Neither architecture requires a constantly running web server; individual Functions may cold-start. Free quotas can still suspend service when exhausted; $0 does not promise unlimited traffic or guaranteed uptime.

## Architecture and choice

One Next.js 16 App Router project deploys both the frontend and `/api/*` as Node.js 22 Functions. Keep the Next.js framework preset; do **not** use static export, GitHub Pages, an HTML-only upload, or a catch-all SPA redirect. No separate API server, database, paid storage, cron keep-alive, or subscription is required for this demo.

- Planner/registration/career logic reads bundled JSON using `process.cwd()`.
- RAG builds a real corpus from bundled UW data and uses real keyword ranking/extractive answers with citations, including server-regenerated plan context.
- The existing embedding index remains packaged; hosted $0 mode does not call an external service to embed queries or generate text. This is local source-based retrieval, not a fake AI response or a claim of live hybrid/LLM inference.
- PDF extraction runs in memory in a Node Function; native canvas, worker and font assets must be packaged.
- Browser data stays in the existing demo localStorage. This deployment does not add real authentication or persistent student storage.
- Academic planning behavior/limitations documented in `reports/project-review-2026-10-18.md` remain unchanged; deployment does not certify registration eligibility or degree completion.

Vercel Hobby is the simplest match for the existing Next.js routes. It has no whole-application 15-minute inactivity shutdown requirement. It is limited to personal/non-commercial use; deploy under the verified Hobby owner, without adding paid seats, Pro trials or paid add-ons. See [Hobby plan](https://vercel.com/docs/plans/hobby) and [Next.js support](https://vercel.com/docs/frameworks/full-stack/nextjs).

## Configuration in this repository

- `vercel.json`: Next.js preset, `npm ci`, `npm run build:free`, mandatory free-demo runtime flags, no paid services.
- `next.config.ts`: explicit server-side data/index traces; PDF worker/canvas/font traces; excludes archived data, spreadsheets, env files and machine artifacts.
- `.vercelignore`: excludes credentials, `.env*` except the empty template, `.git`, local tools/builds, uploaded PDFs and documentation from source upload.
- `package.json`/lockfile: Node `22.x`. No new runtime dependency was added.
- `scripts/build-free.mjs`: cross-platform free build with same-origin URLs, mock flags off, and no provider keys.
- `lib/ai-config.ts`: external calls disabled by free-demo flags, even if a key is accidentally set later. `openaiClient()` itself refuses construction in that mode; goal/explanation/retrieval/Ask all use the guard.
- API routes remain `runtime='nodejs'`, with maximum duration 60 seconds. No Edge conversion or route substitution.
- `netlify.toml`: backup Next.js build configuration, same free flags, no static rewrite.

The public free-demo flag is baked into the server build too, providing a second guard if runtime configuration is incomplete. There is no automatic paid fallback. Leave provider keys unset; do not use `build:index` on the host, AI Gateway, Blob/KV add-ons, purchased domains, auto-recharge, or Pro trial.

## API URLs, CORS and environment

All browser calls remain relative `/api/plan`, `/api/transcript`, `/api/goal`, `/api/ask`. Same origin means no extra CORS permission is needed. Do not point the deployed browser at localhost, add wildcard credentialed CORS, or rewrite API requests to the homepage.

Required settings (already applied by the free build / Vercel config):

```text
DEGREEGPS_FREE_DEMO=true
NEXT_PUBLIC_FREE_DEMO=true
NEXT_PUBLIC_API_BASE_URL=
NEXT_PUBLIC_USE_MOCK_DATA=false
NEXT_PUBLIC_USE_MOCK_TRANSCRIPT=false
AI_RATE_PER_MINUTE=0
AI_RATE_PER_DAY=0
AI_RATE_GLOBAL_PER_DAY=0
```

Do not add OPENAI_API_KEY / GEMINI_API_KEY / GOOGLE_API_KEY to the deployment. Keys must never have a NEXT_PUBLIC_ prefix. The compiled guard still prevents paid requests if a key is mistakenly configured. AI opt-in requests return an explicit AI_DISABLED warning and real local results. The Ask checkbox defaults off in free-demo builds. No API key is shipped to the browser.

## PDF platform limit

Vercel Functions impose a **4.5 MB request/response payload limit**. The deployed browser/API therefore advertise and enforce **4 MiB per PDF** to leave multipart overhead. Normal local development retains the original 5 MiB limit. The PDF endpoint, 30-page bound, parser, review and grade confirmation remain real and functional; no transcript is routed to a paid store or external model.

For larger transcripts, export a smaller text PDF or use manual course entry. A request above the host's transport limit can be rejected by the provider before application JSON error handling; the frontend prevents such uploads. Supporting arbitrary 5+ MiB direct uploads on this host requires an additional upload design, not a config setting that bypasses the provider limit. See [Function limits](https://vercel.com/docs/functions/limitations).

## Local verification before deployment

Use Node 22. On this Mac only, if Node is not on PATH:

```sh
export PATH="$PWD/.tools/node-v22.23.3-darwin-arm64/bin:$PATH"
```

Then:

```sh
npm ci
npm run check
npm run build:free
npm run check:serverless
npm run start -- --port 3117
```

In another terminal:

```sh
npm run verify:deployment
```

`check:serverless` reconstructs each function from its actual Next.js `.nft.json` trace in an isolated directory. It uses no source-data or node_modules symlink, tests a synthetic PDF and all five API modules, sets a synthetic provider key, and forbids all outgoing fetches. This catches missing native/worker assets that a regular local build cannot detect.

`verify:deployment` tests the homepage, real 8-quarter Planner, cited plan-aware RAG, local goal interpretation with explicit AI opt-in, synthetic PDF confirmation, errors goal/load regeneration, private-file 404s and the 4 MiB upload boundary. It works against local or public origins.

## Publish directly without a Git push

A personal Hobby account must be registered and authorized in the browser. No password/token needs to be pasted into chat. The project created for this session is **degreegps**, under the confirmed Hobby workspace **gps-119d**. No Git integration was connected, no code pushed, and no plan upgraded.

CLI used: Vercel **64.5.0**. Commands below download only the deployment CLI, not a subscription:

```sh
npx --yes vercel@64.5.0 login
npx --yes vercel@64.5.0 teams ls --json
```

Verify that the target team's `plan` is `hobby`. Do not select a Pro/trial space. If the project already exists and a fresh checkout is not linked:

```sh
npx --yes vercel@64.5.0 link --yes --scope gps-119d --project degreegps
```

Keep any existing local `.env.local`; do not overwrite it if the CLI offers environment-file setup. This session created/linked the project without pulling env files or connecting Git.

Inspect the actual source-upload inventory before publishing:

```sh
npx --yes vercel@64.5.0 deploy --dry --json
```

Confirm it excludes keys, `.env.local`, local student files, `.tools`, node_modules and `.git`. The reviewed session upload contained 122 files, approximately 14.2 MB; later documentation additions do not enter this upload because docs are ignored.

Publish the reviewed local working directory:

```sh
npx --yes vercel@64.5.0 deploy --prod --yes --scope gps-119d
```

This uploads local source directly; **it does not commit or push GitHub**. Use the CLI's returned production alias. There is no separate backend URL. The default `.vercel.app` domain is sufficient; do not purchase a domain.

For public demo access, check the returned production alias in a logged-out/incognito browser. Vercel preview URLs may be protected; use the Production deployment/domain. If protection blocks production, disable only the project's protection for that demo domain using the included free settings—do not buy password-protection add-ons.

Verify the public URL (already verified for this deployment):

```sh
DEGREEGPS_SMOKE_ORIGIN=https://degreegps.vercel.app npm run verify:deployment
```

PowerShell equivalent:

```powershell
$env:DEGREEGPS_SMOKE_ORIGIN="https://degreegps.vercel.app"
npm run verify:deployment
```

Retest public PDF upload, goal/load edits and Ask from a private browser. A passing local build alone is not a hosted verification result.

## Netlify Free fallback

Use only if Vercel Hobby is unavailable/ineligible, not as a second paid deployment. Select the actual **Free** plan. Its current credits have a hard cap without paid recharge; after exhaustion projects can pause until the next cycle. This is different from sleeping after 15 minutes idle. See [Netlify Free pricing](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/).

The prepared `netlify.toml` uses the automatic Next.js integration: Node 22, build `npm run build:free`, publish `.next`, free runtime/build flags. Do not use Netlify Drop to upload HTML or `.next` manually, because that can lose the server routes. Prefer Netlify's cloud/Linux build from the repository **after Git push approval**; a local Mac-built native canvas binary cannot be assumed to run on Linux.

Use the free `.netlify.app` domain. Verify all API routes, same-origin fetches, PDF native dependencies and the public smoke script there. Netlify has not been deployed/tested in this session; its configuration is a fallback, not a second claimed successful release.

## Budget and operational boundaries

No subscriptions, trials, payment method, paid AI, database, storage add-ons or custom domains are needed for the prepared path. Hobby usage is finite; quota exhaustion can stop availability rather than authorize spending. Avoid repeated remote builds or load tests. Function cold starts remain possible. In-memory rate counters are not shared across serverless instances, so they are not treated as a spending guarantee; the hard external-AI guard provides that protection for this demo.

Deployment does not solve the separately documented academic validation issues or turn demo login into secure user accounts. Use synthetic students in the public demo. No real transcript is bundled, and extraction is in memory with no external AI transmission.
