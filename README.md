# MailPilot

> Turn your Gmail inbox into a **triage system** that answers three questions:
> _What happened? What do I need to do? What am I waiting for?_

MailPilot connects to Gmail, scans messages over a chosen time window, analyzes each
**thread in context** with an LLM, classifies it, syncs managed Gmail labels, and produces an
Inbox Digest, an Action Center, and a Waiting list.

The complete product and technical specification is in
[`docs/PROJECT_SPEC.md`](docs/PROJECT_SPEC.md); product-level decisions that refine it are in
[`docs/PRODUCT_DECISIONS.md`](docs/PRODUCT_DECISIONS.md). Together they are the source of truth
for the build. (`MailPilot` is the chosen product name; the spec was written under the temporary
name "Inbox Triage AI".)

---

## Project status

Built **phase by phase** (spec §63). Owner overlay: [`docs/PRODUCT_DECISIONS.md`](docs/PRODUCT_DECISIONS.md).

- **Phase 0 — Bootstrap:** complete.
- **Phase 1 — Auth + DB:** login and signup; `profiles` + RLS.
- **Phase 2 — Gmail OAuth:** Connect / callback / status / disconnect, encrypted refresh tokens,
  and automatic `MailPilot/*` labels. Expired tokens surface as `REAUTH_REQUIRED`.
- **Phase 3 — Parser:** MIME parser, attachment metadata (no binary), thread context with
  INBOUND/OUTBOUND direction.
- **Phase 4 — AI triage:** Gemini structured JSON (`GEMINI_API_KEY` / `GEMINI_MODEL`),
  Zod schema, deterministic post-processing, prompt-injection wrapping, and eval
  fixtures (`npm run eval:scorecard`).
- **Phase 5 — Initial scan:** dashboard **Scan now** (lookback up to a month),
  Gmail list + thread analysis, idempotent DB upserts, action and
  MailPilot label reconciliation, and inbox counters. Failed AI does not apply
  labels. Apply `0003_initial_scan.sql`.
- **Phase 6–7 — Dashboard + incremental sync:** Mail tabs, thread actions,
  History API with stale-history recovery.
- **Phase 8 — Daily scheduled scan:** global cron dispatcher, 270s job lease,
  one connection per Hobby invocation, bounded retry, scan preferences, and
  scan history. Default 08:00 Asia/Jerusalem. Apply `0007_scan_scheduling.sql`
  and `0008_scan_admission.sql`.
- **Phase 9 — Digest:** in-app digest after each successful or partial scan
  (period counts from the DB, unique top open tasks, history on `/digests`).
  Apply `0006_digest_reports.sql`. **Email digest delivery is not in the MVP.**

Also in the app: triage settings (VIP/ignore/domains/custom instructions),
first-run `/onboarding`, Settings privacy (delete analysis / disconnect Gmail /
delete account), and skip-to-content plus labeled navigation.

Phase 2 requires Google OAuth credentials in `.env.local` and the `0002_gmail_connections.sql`
migration applied to your Supabase project. Phase 5 also needs
`0003_initial_scan.sql` and a configured `GEMINI_API_KEY`.

## Google Cloud / Gmail setup

1. Create a Google Cloud project and enable the **Gmail API**.
2. Configure the OAuth consent screen (External + Testing is fine). Add your Gmail as a test user.
3. Create OAuth client credentials of type **Web application**.
4. Authorized redirect URI must match exactly:
   `http://localhost:3000/api/gmail/callback`
5. Put these in `.env.local`:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI=http://localhost:3000/api/gmail/callback`
   - `TOKEN_ENCRYPTION_KEY` — generate with `openssl rand -hex 32`
6. Restart `npm run dev`, sign in, complete `/onboarding`, and click **Connect Gmail**.
7. Scope requested: `https://www.googleapis.com/auth/gmail.modify` (minimum needed to read mail and apply labels).

Production OAuth: add the deployed callback
(`https://<your-domain>/api/gmail/callback`) as an Authorized redirect URI and
set `GOOGLE_REDIRECT_URI` and `NEXT_PUBLIC_APP_URL` to that origin.

On first connect, MailPilot creates these labels if they are missing:

- `MailPilot/Important`
- `MailPilot/Action Required`
- `MailPilot/Low Priority`
- `MailPilot/Processed`

The refresh token is encrypted (AES-256-GCM) and never sent to the browser.

## Migrations

Apply SQL in the Supabase SQL Editor, **in this order** (all nine files):

1. `supabase/migrations/0001_profiles.sql` — app profiles.
2. `supabase/migrations/0002_gmail_connections.sql` — Gmail OAuth connections and labels.
3. `supabase/migrations/0003_initial_scan.sql` — threads, messages (no bodies), actions, scan runs, triage settings.
4. `supabase/migrations/0004_classification_feedback.sql` — thread classification feedback.
5. `supabase/migrations/0005_scan_progress.sql` — live scan progress counters.
6. `supabase/migrations/0006_digest_reports.sql` — in-app digest snapshots.
7. `supabase/migrations/0007_scan_scheduling.sql` — leases, `scan_jobs`, dispatcher claim.
8. `supabase/migrations/0008_scan_admission.sql` — unique RUNNING scan per Gmail connection.
9. `supabase/migrations/0009_function_hardening.sql` — pin trigger `search_path` and revoke Data API execute on `handle_new_user`.

Do not skip later files: scheduled scans need 0007+0008; digests need 0006. Apply 0009 on any project that already ran 0001.

## Architecture

- **Frontend:** Next.js (App Router) + React + TypeScript + Tailwind CSS + shadcn/ui.
- **Backend:** Next.js Route Handlers / server-side services under `src/lib/**`.
- **Database:** Supabase PostgreSQL (with Row Level Security).
- **Auth:** Supabase Auth for the app account; a separate Google OAuth flow for Gmail authorization.
- **AI:** Google Gemini with JSON Schema structured output, validated with Zod.
- **Scheduler:** a single global cron dispatcher that claims due connections (not per-user cron).
- **Hosting:** Vercel.

## Prerequisites

- Node.js 22+ and npm.
- A Supabase project (for Phase 1+).
- A Google Cloud project with the Gmail API enabled and OAuth credentials (for Phase 2+).
- A Gemini API key (`GEMINI_API_KEY`) and model (`GEMINI_MODEL`, for Phase 4+).

## Local setup

```bash
npm install
cp .env.example .env.local   # then fill in values (see below)
npm run dev                  # http://localhost:3000
```

The landing page runs without any secrets configured. Features that need secrets validate
them lazily and fail fast with a clear message when they are missing.

## Environment variables

Copy `.env.example` to `.env.local` and fill in values. Never commit real secrets.

| Variable                                                                                | Purpose                                                 |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`                                                                   | Public base URL for links and OAuth redirects.          |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`                            | Supabase public client config.                          |
| `SUPABASE_SERVICE_ROLE_KEY`                                                             | Server-only privileged key. Never expose to the client. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI`                     | Gmail OAuth. Redirect URI must match Google Cloud exactly. |
| `TOKEN_ENCRYPTION_KEY`                                                                  | 32-byte key for AES-256-GCM refresh-token encryption (`openssl rand -hex 32`). |
| `GEMINI_API_KEY` / `GEMINI_MODEL`                                                       | Gemini access; model is configurable, not hard-coded.   |
| `CRON_SECRET`                                                                           | Protects the cron dispatcher (`Authorization: Bearer` or `x-cron-secret`). |
| `MAX_THREAD_MESSAGES` / `MAX_MESSAGE_CHARS` / `MAX_THREAD_CHARS` / `AI_MAX_CONCURRENCY` | Context and cost controls.                              |
| `GMAIL_QUOTA_UNITS_PER_MINUTE`                                                          | Optional local Gmail quota budget (default 12000).      |
| `NEXT_PUBLIC_SENTRY_DSN`                                                                | Optional Sentry DSN (public). App runs without it.      |
| `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN`                                   | Optional build-only source-map upload. Never `NEXT_PUBLIC_`. |

## Supabase setup

1. Create a Supabase project and copy its URL and keys into `.env.local`.
2. Apply the SQL files in `supabase/migrations/` (SQL Editor), in numeric order.
3. Row Level Security is required on all user-accessible tables (`user_id = auth.uid()`).

## Running & scripts

```bash
npm run dev              # start the dev server
npm run build            # production build
npm run start            # run the production build
npm run lint             # ESLint
npm run typecheck        # tsc --noEmit
npm test                 # Vitest (run once)
npm run test:watch       # Vitest (watch mode)
npm run test:integration # mocked scan + RLS isolation tests
npm run eval:scorecard   # triage eval thresholds
npm run format           # Prettier write
```

## Testing

Unit tests use Vitest with a jsdom environment and Testing Library. Test files live next to the
code they cover as `*.test.ts(x)`. Phase 4 eval fixtures live in `tests/fixtures/` and
`tests/evals/` (spec §48). Integration coverage for idempotent scans and RLS policies is
`npm run test:integration`. See `docs/PROJECT_SPEC.md` §50–52 for the broader test plan.

## Cron configuration

A single global dispatcher (`GET`/`POST` `/api/cron/scan-dispatcher`) selects due Gmail
connections (`next_scan_at <= now()`), claims them with a job lease, and runs incremental
scans. It is protected by `CRON_SECRET` (`Authorization: Bearer …` or `x-cron-secret`) and
must never be publicly executable. A request without that header returns `401 unauthorized`;
that is expected when probing the URL in a browser. Vercel Cron injects
`Authorization: Bearer $CRON_SECRET` automatically. To trigger the job on a deployment, use
`vercel crons run /api/cron/scan-dispatcher` (do not paste the secret into chat or logs).

`vercel.json` schedules `0 6 * * *` (06:00 UTC once per day). That is Hobby-safe (Vercel
Hobby allows one cron). Combined with each user's `next_scan_at` (default 08:00
Asia/Jerusalem), due connections are claimed on that daily tick. The route sets
`maxDuration = 300` and a 270-second work budget, and processes **one connection per
invocation** so the run can finish on Hobby. Manual **Scan now** uses the same
Hobby `maxDuration = 300` on `/api/scans` (values above 300 fail to deploy).

Apply `0007_scan_scheduling.sql` and `0008_scan_admission.sql` before relying on
scheduled scans. Unique admission prevents a manual scan and the dispatcher from both
marking the same connection RUNNING.

## Deployment

Deploy on Vercel. Configure every variable from `.env.example` in the project settings.

- Set `NEXT_PUBLIC_APP_URL` to the production origin (no trailing slash).
- Set `GOOGLE_REDIRECT_URI` to `{NEXT_PUBLIC_APP_URL}/api/gmail/callback` and add the
  same URI in Google Cloud.
- Set `CRON_SECRET` and keep the `vercel.json` cron path as `/api/cron/scan-dispatcher`.
- Apply all nine migrations to the production Supabase project before the first scan.

There is no digest email to configure. Digests appear in the app after scans.

If you deploy on the Vercel Hobby plan, function durations must stay at or below 300 seconds and
built-in cron jobs are limited to once per day. More frequent scheduler triggers require Vercel Pro
or an external scheduler that calls the dispatcher endpoint securely.

## OAuth production considerations

`gmail.modify` is a restricted Gmail scope. Test users can connect before verification.
A public launch still needs Google’s process, not a code change:

1. OAuth consent screen: homepage, `/privacy`, and `/terms`, plus authorized domains that match
   `NEXT_PUBLIC_APP_URL`. `/robots.txt` allows those public URLs and blocks signed-in app routes.
2. Keep requesting only `https://www.googleapis.com/auth/gmail.modify`.
3. Follow [Limited Use](https://developers.google.com/terms/api-services-user-data-policy#additional_requirements_for_specific_api_scopes)
   (no ads, no selling Gmail data, prominent user-facing features only). The in-app text is `/privacy`.
4. Complete [restricted-scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification).
   Because MailPilot stores and transmits Gmail data on servers, Google can require an annual
   [CASA](https://support.google.com/cloud/answer/13465431) security assessment.
5. See spec §38.

This is owner work in Google Cloud. Shipping `/privacy` and `/terms` does not replace verification.

## Troubleshooting

- **App fails to start complaining about environment variables:** a server feature needs a secret
  that isn't set. Fill in `.env.local` from `.env.example`.
- **Supabase/Google/Gemini calls fail:** verify the corresponding keys. For Gmail OAuth, the
  redirect URI must match the OAuth client exactly. For Gemini, confirm `GEMINI_API_KEY` and
  `GEMINI_MODEL`.
- **Type or lint errors after adding code:** run `npm run typecheck` and `npm run lint` locally.
- **Leaked password protection warning in Supabase:** enable it under Authentication → Attack Protection
  (HaveIBeenPwned). This is a dashboard setting, not a SQL migration, and requires the Supabase Pro plan.

## Security notes

Never log email bodies, OAuth tokens, authorization codes, or API keys. Refresh tokens are stored
encrypted server-side and never returned to the client. Sentry is optional and must not receive
Gmail content, OAuth tokens, API keys, email bodies, or personally identifiable email data; only
`environment`, `route`, `provider`, `scan_type`, and `error_category` tags are allowed. See spec
§37 for the full policy.
