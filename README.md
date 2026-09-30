# MailPriority

Gmail inbox triage that answers three questions: **what happened, what do I need to do, and what’s pending?**

The GitHub repository and Gmail label prefix stay **MailPilot** (`MailPilot/`). The public app is [gmailpilot.vercel.app](https://gmailpilot.vercel.app).

## Live Demo

**App:** [gmailpilot.vercel.app](https://gmailpilot.vercel.app)

The landing page is public. Inbox features need a MailPriority account and a separate Gmail connection. Google OAuth may be limited to configured test users while the integration is in Testing. For a code review without mailbox access, start with Architecture, AI Evaluation, and the test suites below.

## Project Status

| Area                    | Evidence-based status                                                                                                                                                                                                                                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Implemented on `main`   | Account auth, separate Gmail OAuth, scanning, structured classification (NVIDIA Build when configured, otherwise Gemini), Mail tabs, Gmail labels, incremental History API sync, resumable jobs, scheduled dispatch, in-app digests, privacy controls, and deletion flows are present in the released code.            |
| Automatically tested    | GitHub Actions runs format, lint, typecheck, unit, mocked integration, deterministic eval-scorecard, and production-build checks. These tests do not call a real Gmail inbox, NVIDIA, Gemini, or the production database.                                                                                              |
| Deployed                | Vercel serves the public landing, privacy, and terms pages from `main` at the canonical URL above.                                                                                                                                                                                                                     |
| Live owner verification | Sign-in, Connect Gmail, reconnect, disconnect, and one last-week Scan now already ran on production. Still open in [`docs/HUMAN_TASKS.md`](docs/HUMAN_TASKS.md): Mail tabs and `MailPilot/*` labels, a second incremental scan, the Supabase Google provider, URL configuration, and public-launch OAuth verification. |
| Unmerged work           | No functionality that exists only in a branch or pull request is counted as shipped.                                                                                                                                                                                                                                   |
| License                 | No code license has been selected. **Owner decision required.**                                                                                                                                                                                                                                                        |

## What MailPriority Does

MailPriority connects one Gmail inbox, scans threads over a chosen window, classifies them with structured JSON (NVIDIA Build when `NVIDIA_API_KEY` is set, otherwise Gemini), validates that JSON with Zod, applies `MailPilot/*` labels, and shows an inbox summary, Actions, a Pending list, and an in-app digest. It never auto-sends, deletes, or archives mail.

- **Scan now** with lookback of 1–4 days, 1–3 weeks, or 1 month (default 7 days)
- **Incremental sync** via the Gmail History API after the first successful scan
- **Daily scheduled scan** (default user time 08:00 Asia/Jerusalem). The dispatcher claims due connections (`next_scan_at`). On Vercel Hobby, `vercel.json` runs that dispatcher once per day (`0 6 * * *` UTC). In-app retry delays therefore wait until the next daily tick.
- **Resumable scans** across Vercel Hobby time slices so large lookbacks finish
- **Mail tabs:** Summary, Actions, Pending, Completed, Snoozed, Ignored. Actions are grouped by category.
- **Gmail labels:** `MailPilot/Important`, `MailPilot/Action Required`, `MailPilot/Low Priority`, `MailPilot/Processed`
- **In-app digest** after each successful or partial scan (email digest is not in the MVP)
- **Privacy:** no long-term storage of full email bodies; failed AI does not apply labels; users can delete analysis data or the account

OTP / login-FYI notices are not open tasks.

Product decisions that override the historical spec: [`docs/PRODUCT_DECISIONS.md`](docs/PRODUCT_DECISIONS.md). Full contracts: [`docs/PROJECT_SPEC.md`](docs/PROJECT_SPEC.md).

## Engineering Highlights

| Capability                         | Evidence                                                                                |
| ---------------------------------- | --------------------------------------------------------------------------------------- |
| Gmail API (`gmail.modify`)         | `src/lib/gmail/`, OAuth in `src/lib/gmail/oauth.ts`                                     |
| Structured JSON triage             | NVIDIA in `src/lib/ai/nvidia.ts`; Gemini `responseJsonSchema` in `src/lib/ai/client.ts` |
| Zod validation + invariants        | `src/lib/ai/schemas.ts`, `src/lib/ai/post-process.ts`                                   |
| History API incremental sync       | `src/lib/gmail/history.ts`, `src/lib/gmail/history.test.ts`                             |
| Resumable serverless scans         | `0012_scan_chunk_resume.sql`, `src/lib/scans/process-scan.ts`                           |
| Scheduled scans + job leases       | `/api/cron/scan-dispatcher`, `0007`/`0008`, `src/lib/scans/dispatcher.ts`               |
| Supabase PostgreSQL + RLS          | `supabase/migrations/`, `src/lib/privacy/rls-isolation.test.ts`                         |
| Encrypted Gmail refresh tokens     | AES-256-GCM in `src/lib/security/encryption.ts`                                         |
| Privacy / data deletion            | Settings + `/api/privacy/*`, `src/lib/privacy/deletion.test.ts`                         |
| Observability (no mail/token logs) | `src/lib/observability/events.ts`, `sentry-privacy.test.ts`                             |
| CI                                 | `.github/workflows/ci.yml`                                                              |
| Unit + integration tests           | `*.test.ts` next to source; `npm run test:integration`                                  |
| AI evaluation scorecard            | `src/lib/ai/eval-scorecard.ts`, `tests/evals/`, `npm run eval:scorecard`                |

Explore [`src/lib/ai/`](src/lib/ai/), [`src/lib/scans/`](src/lib/scans/), and [`tests/evals/email-triage.json`](tests/evals/email-triage.json).

## Architecture

```text
Browser (Next.js App Router)
  ├─ Supabase Auth          MailPriority account (no Gmail scopes)
  └─ App UI                 dashboard, Mail tabs, settings, onboarding

Server (Vercel)
  ├─ Connect Gmail          OAuth gmail.modify → encrypted refresh token
  ├─ Scan pipeline          Gmail fetch → MIME/thread parse → triage JSON
  │                         → Zod + post-process → Postgres upserts → labels
  ├─ Incremental sync       Gmail History API (stale historyId recovery)
  └─ Cron dispatcher        claims due connections, 270s lease, chunk resume

Supabase Postgres + RLS     profiles, connections, threads, actions, scans, digests
NVIDIA Build or Gemini      structured ThreadAnalysis JSON only
```

Manual Scan now and scheduled scans share the same pipeline. One connection may have only one `RUNNING` scan. A slice that hits the Hobby wall-clock budget stays `RUNNING` with a thread cursor and continues until the window is done. The in-app digest is written when the window finishes with `SUCCESS` or `PARTIAL`. The Gmail History API cursor (`historyId`) advances only on `SUCCESS`, so a partial scan can rediscover failed threads.

## AI Evaluation

Durable gates on a curated fixture set (English, Hebrew, mixed). CI runs `npm run eval:scorecard`. These are **quality gates on the eval harness** (fixtures + schema + post-processing), not live-inbox accuracy claims.

| Gate                     | Threshold | Where it is enforced                               |
| ------------------------ | --------- | -------------------------------------------------- |
| Schema validity          | **100%**  | `EVAL_THRESHOLDS.schemaValidity`                   |
| Action recall            | **≥ 90%** | `EVAL_THRESHOLDS.actionRecall`                     |
| Deadline hallucination   | **0**     | `EVAL_THRESHOLDS.deadlineHallucination`            |
| Curated evaluation cases | **≥ 50**  | `eval-scorecard.test.ts` / `eval-fixtures.test.ts` |

Fixtures must not invent ISO deadlines. Prompt-injection cases still require a real reply. Gold analyses are schema-valid. See [`tests/fixtures/README.md`](tests/fixtures/README.md).

## Security & Privacy

- Refresh tokens stored encrypted (AES-256-GCM); never returned to the browser
- Row Level Security: `user_id = auth.uid()` on user-accessible tables
- No long-term full email body storage
- Never log email bodies, OAuth tokens, authorization codes, or API keys
- Optional Sentry: tags limited to `environment`, `route`, `provider`, `scan_type`, `error_category`
- In-app [privacy](https://gmailpilot.vercel.app/privacy) and [terms](https://gmailpilot.vercel.app/terms) pages; Settings can delete analysis data, disconnect Gmail, or delete the account
- `gmail.modify` is a restricted Google scope. A **public** launch still needs Google OAuth verification (and CASA when Google requires it)

## Tech Stack

| Layer       | Choice                                                                       |
| ----------- | ---------------------------------------------------------------------------- |
| App         | Next.js (App Router), React, TypeScript, Tailwind CSS, shadcn/ui             |
| Data / auth | Supabase Postgres + RLS; Supabase Auth for the app account                   |
| Gmail       | Separate Google OAuth (`gmail.modify`); refresh tokens encrypted AES-256-GCM |
| AI          | NVIDIA Build when `NVIDIA_API_KEY` is set; otherwise Google Gemini           |
| Hosting     | Vercel (Hobby-safe dispatcher: one connection per run, `maxDuration` 300s)   |
| CI          | GitHub Actions: format, lint, typecheck, unit, integration, eval, build      |

Email digest delivery is not implemented; the product currently creates in-app digests only.

## Testing

```bash
npm run format:check
npm run lint
npm run typecheck
npm test                 # Vitest, including eval-scorecard.test.ts
npm run test:integration # mocked scan + RLS isolation + deletion
npm run eval:scorecard   # triage eval thresholds
npm run build
```

Unit tests live next to the code they cover as `*.test.ts(x)`. `npm test` fails if schema validity, action recall, or deadline hallucination regress below `EVAL_THRESHOLDS`.

## Local Setup / Deployment

```bash
npm install
cp .env.example .env.local   # fill in real values; never commit .env.local
npm run dev                  # http://localhost:3000
```

Prerequisites: Node.js 22+, a [Supabase](https://supabase.com) project, a Google Cloud project with the **Gmail API** enabled and OAuth **Web application** credentials, and either an NVIDIA Build key (`NVIDIA_API_KEY`) or a Gemini API key (`GEMINI_API_KEY` / `GEMINI_MODEL`). NVIDIA is used when its key is set.

The landing page runs without secrets. Features that need configuration fail fast with a clear message.

### Google Cloud: two different OAuth uses

Use the **same** OAuth 2.0 Web application client for both. They are not interchangeable callbacks.

**1. Continue with Google (MailPriority account)** — Supabase Auth, no Gmail scopes.

1. Keep the existing Gmail redirect URI on the Web client (do not remove it).
2. Add authorized redirect URI `https://<your-project-ref>.supabase.co/auth/v1/callback`.
3. In Supabase (Authentication → Providers → Google) enable Google and enter the Web client ID and secret. Never commit the secret.
4. Authentication → URL Configuration: Site URL = `https://gmailpilot.vercel.app`. Redirect URLs must include `http://localhost:3000/auth/confirm`, `http://localhost:3000/**`, and `https://gmailpilot.vercel.app/auth/confirm`. Without the localhost entries, Continue with Google from local falls back to the production Site URL.
5. Sign-in returns to `/auth/confirm` (PKCE), then `/onboarding`. Gmail stays disconnected until Connect Gmail.

**2. Connect Gmail (mailbox access)** — server OAuth with `gmail.modify`.

1. Enable the Gmail API and configure the OAuth consent screen (External + Testing is fine). Add your Gmail as a test user.
2. Authorized redirect URI must be exactly `http://localhost:3000/api/gmail/callback` (and the production URL in Vercel).
3. Put `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, and `TOKEN_ENCRYPTION_KEY` (`openssl rand -hex 32`) in `.env.local`. These env vars are **Gmail Connect only**; they are not used for Continue with Google.
4. Restart the app, sign in, and click **Connect Gmail** on `/dashboard` or `/onboarding`.

Scope requested for Connect Gmail: `https://www.googleapis.com/auth/gmail.modify` (read mail and apply labels). Labels above are created on first connect if missing.

### Environment variables

Copy from [`.env.example`](.env.example). Server secrets must never use a `NEXT_PUBLIC_` prefix.

| Variable                                                                                | Purpose                                                     |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`                                                                   | Public base URL for links and OAuth redirects               |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`                            | Supabase public client                                      |
| `SUPABASE_SERVICE_ROLE_KEY`                                                             | Server-only privileged key                                  |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI`                     | Gmail OAuth                                                 |
| `TOKEN_ENCRYPTION_KEY`                                                                  | 32-byte key for AES-256-GCM refresh-token encryption        |
| `TOKEN_ENCRYPTION_PREVIOUS_KEY`                                                         | Optional previous key during rotation                       |
| `GEMINI_API_KEY` / `GEMINI_MODEL`                                                       | Gemini access; used when `NVIDIA_API_KEY` is unset          |
| `NVIDIA_API_KEY` / `NVIDIA_MODEL`                                                       | NVIDIA Build chat API; primary triage provider when set     |
| `CRON_SECRET`                                                                           | Protects `/api/cron/scan-dispatcher`                        |
| `MAX_THREAD_MESSAGES` / `MAX_MESSAGE_CHARS` / `MAX_THREAD_CHARS` / `AI_MAX_CONCURRENCY` | Context and cost controls                                   |
| `GMAIL_QUOTA_UNITS_PER_MINUTE`                                                          | Optional local Gmail quota budget (default 12000)           |
| `NEXT_PUBLIC_SENTRY_DSN`                                                                | Optional Sentry DSN (public). App runs without it           |
| `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN`                                   | Optional build-only source-map upload. Never `NEXT_PUBLIC_` |

### Migrations

Apply SQL in the Supabase SQL Editor, in this order:

1. `supabase/migrations/0001_profiles.sql`
2. `supabase/migrations/0002_gmail_connections.sql`
3. `supabase/migrations/0003_initial_scan.sql`
4. `supabase/migrations/0004_classification_feedback.sql`
5. `supabase/migrations/0005_scan_progress.sql`
6. `supabase/migrations/0006_digest_reports.sql`
7. `supabase/migrations/0007_scan_scheduling.sql`
8. `supabase/migrations/0008_scan_admission.sql` — one RUNNING scan per Gmail connection
9. `supabase/migrations/0009_function_hardening.sql` — signup trigger not callable via the Data API
10. `supabase/migrations/0010_gmail_mailbox_uniqueness.sql` — one Gmail inbox cannot be connected to two MailPriority users at once
11. `supabase/migrations/0011_check_constraints.sql` — status, confidence, and counter checks
12. `supabase/migrations/0012_scan_chunk_resume.sql` — resume large scans across 5-minute function slices
13. `supabase/migrations/20260929174644_analysis_scan_attribution.sql` — attribute each saved analysis to the scan that wrote it. Apply this before deploying the matching app code. Existing analysis stays unattributed. It is not recorded as applied on `mailpilot-dev` yet.

RLS is required on user-accessible tables (`user_id = auth.uid()`).

### Scripts

```bash
npm run dev              # development server
npm run build            # production build
npm run start            # run the production build
npm run lint             # ESLint
npm run typecheck        # tsc --noEmit
npm test                 # Vitest (Windows uses scripts/run-vitest.mjs)
npm run test:watch       # Vitest watch
npm run test:integration # mocked scan + RLS isolation tests
npm run eval:scorecard   # triage eval thresholds
npm run format           # Prettier write
npm run format:check     # Prettier check (CI)
```

### Cron and Vercel

`GET`/`POST` `/api/cron/scan-dispatcher` claims due Gmail connections (`next_scan_at`), holds a job lease, and runs incremental scans. Protect it with `CRON_SECRET` (`Authorization: Bearer …` or `x-cron-secret`).

Each user has a daily wall-clock time (default 08:00) in their timezone (default Asia/Jerusalem). That becomes `next_scan_at` in UTC. Vercel Hobby allows built-in cron once per day; this repo uses `0 6 * * *` UTC. Connections that are already due at that tick run. Bounded retry timestamps in the scheduler can be earlier than the next daily time, but on Hobby they are not picked up until the next daily invocation. Manual Scan now and scan-continue slices do not wait for cron.

Hobby plans also cap function duration at 300 seconds. On Vercel, set the same environment variables, and make `GOOGLE_REDIRECT_URI` and `NEXT_PUBLIC_APP_URL` match the deployed domain.

Owner console steps that cannot be done in git: [`docs/HUMAN_TASKS.md`](docs/HUMAN_TASKS.md).
