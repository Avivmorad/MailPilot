# MailPilot

Gmail inbox triage that answers three questions: **what happened, what do I need to do, and what am I waiting for?**

MailPilot connects a Gmail account, scans threads over a chosen window, classifies them with Gemini (structured JSON, validated with Zod), applies `MailPilot/*` labels, and shows an inbox summary, open tasks, a waiting list, and an in-app digest. It never auto-sends, deletes, or archives mail.

**Live app:** [mail-pilot-avivmoradteam.vercel.app](https://mail-pilot-avivmoradteam.vercel.app)

The product and technical spec is [`docs/PROJECT_SPEC.md`](docs/PROJECT_SPEC.md). Owner decisions that override it are in [`docs/PRODUCT_DECISIONS.md`](docs/PRODUCT_DECISIONS.md). (The spec still uses the working name “Inbox Triage AI”.)

## What it does

- **Scan now** with lookback of 1–4 days, 1–3 weeks, or 1 month (default 7 days)
- **Incremental sync** via the Gmail History API after the first successful scan
- **Daily scheduled scan** (default 08:00 Asia/Jerusalem) through a global cron dispatcher
- **Mail tabs** for inbox summary vs open tasks (grouped by category) vs ignored noise
- **Gmail labels:** `MailPilot/Important`, `MailPilot/Action Required`, `MailPilot/Low Priority`, `MailPilot/Processed`
- **In-app digest** after each successful or partial scan (email digest is not in the MVP)
- **Privacy:** no long-term storage of full email bodies; failed AI does not apply labels

OTP / login-FYI notices are not open tasks. The MVP does not send replies on the user’s behalf.

## Status

Phases 0–9 of the spec are implemented (auth, Gmail OAuth, MIME/thread parser, Gemini triage, dashboard, incremental sync, daily scans, in-app digests). Phase 10 is hardening (signup-function lockdown, recovery, quality gates)—not new product surface.

## Stack

| Layer | Choice |
| ----- | ------ |
| App | Next.js (App Router), React, TypeScript, Tailwind CSS, shadcn/ui |
| Data / auth | Supabase Postgres + RLS; Supabase Auth for the app account |
| Gmail | Separate Google OAuth (`gmail.modify`); refresh tokens encrypted AES-256-GCM |
| AI | Google Gemini with JSON Schema output, Zod validation |
| Hosting | Vercel (Hobby-safe dispatcher: one connection per run, `maxDuration` 300s) |

## Prerequisites

- Node.js 22+ and npm
- A [Supabase](https://supabase.com) project
- A Google Cloud project with the **Gmail API** enabled and OAuth **Web application** credentials
- A Gemini API key (`GEMINI_API_KEY`) and model (`GEMINI_MODEL`)

## Local setup

```bash
npm install
cp .env.example .env.local   # fill in real values; never commit .env.local
npm run dev                  # http://localhost:3000
```

The landing page runs without secrets. Features that need configuration fail fast with a clear message.

### Google Cloud / Gmail

1. Enable the Gmail API and configure the OAuth consent screen (External + Testing is fine). Add your Gmail as a test user.
2. Create **Web application** OAuth client credentials.
3. Set the authorized redirect URI to exactly `http://localhost:3000/api/gmail/callback` (and the production URL in Vercel).
4. Put `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, and `TOKEN_ENCRYPTION_KEY` (`openssl rand -hex 32`) in `.env.local`.
5. Restart the app, sign in, and click **Connect Gmail** on `/dashboard`.

Scope requested: `https://www.googleapis.com/auth/gmail.modify` (read mail and apply labels). Labels above are created on first connect if missing.

### Environment variables

Copy from [`.env.example`](.env.example). Server secrets must never use a `NEXT_PUBLIC_` prefix.

| Variable | Purpose |
| -------- | ------- |
| `NEXT_PUBLIC_APP_URL` | Public base URL for links and OAuth redirects |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public client |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only privileged key |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | Gmail OAuth |
| `TOKEN_ENCRYPTION_KEY` | 32-byte key for AES-256-GCM refresh-token encryption |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | Gemini access; model is configurable, not hard-coded |
| `CRON_SECRET` | Protects `/api/cron/scan-dispatcher` |
| `MAX_THREAD_MESSAGES` / `MAX_MESSAGE_CHARS` / `MAX_THREAD_CHARS` / `AI_MAX_CONCURRENCY` | Context and cost controls |

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

RLS is required on user-accessible tables (`user_id = auth.uid()`).

## Scripts

```bash
npm run dev         # development server
npm run build       # production build
npm run start       # run the production build
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm test            # Vitest (Windows uses scripts/run-vitest.mjs)
npm run test:watch  # Vitest watch
npm run format      # Prettier write
```

Unit tests live next to the code they cover as `*.test.ts(x)`. Eval fixtures are in `tests/fixtures/` and `tests/evals/`.

## Cron and deployment

`GET`/`POST` `/api/cron/scan-dispatcher` claims due Gmail connections (`next_scan_at`), holds a job lease, and runs incremental scans. Protect it with `CRON_SECRET` (`Authorization: Bearer …` or `x-cron-secret`). `vercel.json` schedules it so daily 08:00 Asia/Jerusalem (and bounded retries) are picked up.

On Vercel, set the same environment variables, and make `GOOGLE_REDIRECT_URI` and `NEXT_PUBLIC_APP_URL` match the deployed domain. Hobby plans cap function duration at 300 seconds and built-in cron at once per day.

`gmail.modify` is a sensitive Gmail scope. A public launch needs Google OAuth verification, a privacy policy, and a clear explanation of Gmail data use. See spec §38.

## Security

Never log email bodies, OAuth tokens, authorization codes, or API keys. Refresh tokens are stored encrypted server-side and never returned to the client. See spec §37.
