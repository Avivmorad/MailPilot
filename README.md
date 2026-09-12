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

Built **phase by phase** (spec §63).

- **Phase 0 — Bootstrap:** complete.
- **Phase 1 — Auth + DB:** login works; `profiles` + RLS applied.
- **Phase 2 — Gmail OAuth:** Connect / callback / status / disconnect, encrypted refresh tokens,
  and automatic `MailPilot/*` labels.
- **Phase 3 — Parser:** MIME parser, attachment metadata (no binary), thread context with
  INBOUND/OUTBOUND direction.
- **Phase 4 — AI triage:** Gemini structured JSON (`GEMINI_API_KEY` / `GEMINI_MODEL`),
  Zod schema, deterministic post-processing, prompt-injection wrapping, and eval
  fixtures.
- **Phase 5 — Initial scan:** dashboard **Scan now** (lookback up to a month),
  Gmail list + thread analysis, idempotent DB upserts, action and
  MailPilot label reconciliation, and inbox counters. Failed AI does not apply
  labels.
- **Phase 6–7 — Dashboard + incremental sync:** Mail tabs, thread actions,
  History API with stale-history recovery.
- **Phase 8 — Daily scheduled scan:** global cron dispatcher, job lease, bounded
  retry, scan preferences, and scan history. Default 08:00 Asia/Jerusalem.
  Apply `0007_scan_scheduling.sql` and `0008_scan_admission.sql`.
- **Phase 9 — Digest:** in-app digest after each successful/partial scan
  (period counts from the DB, unique top open tasks, history on `/digests`).
  Apply `0006_digest_reports.sql`. Email delivery is not in the MVP.
- **Phase 10 — Hardening (in progress):** apply `0009_function_hardening.sql`
  so signup triggers are not callable via the Data API. Next work is remaining
  quality, recovery, and docs — not new product surface.

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
6. Restart `npm run dev`, sign in, and click **Connect Gmail** on `/dashboard`.
7. Scope requested: `https://www.googleapis.com/auth/gmail.modify` (minimum needed to read mail and apply labels).

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
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI`                     | Gmail OAuth.                                            |
| `TOKEN_ENCRYPTION_KEY`                                                                  | 32-byte key for AES-256-GCM refresh-token encryption.   |
| `GEMINI_API_KEY` / `GEMINI_MODEL`                                                       | Gemini access; model is configurable, not hard-coded.   |
| `CRON_SECRET`                                                                           | Protects the cron dispatcher endpoint.                  |
| `MAX_THREAD_MESSAGES` / `MAX_MESSAGE_CHARS` / `MAX_THREAD_CHARS` / `AI_MAX_CONCURRENCY` | Context and cost controls.                              |

## Supabase setup

1. Create a Supabase project and copy its URL and keys into `.env.local`.
2. Apply the SQL files in `supabase/migrations/` (SQL Editor), in numeric order.
3. Row Level Security is required on all user-accessible tables (`user_id = auth.uid()`).

## Running & scripts

```bash
npm run dev         # start the dev server
npm run build       # production build
npm run start       # run the production build
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm test            # Vitest (run once; Windows uses scripts/run-vitest.mjs)
npm run test:watch  # Vitest (watch mode)
npm run format      # Prettier write
```

## Testing

Unit tests use Vitest with a jsdom environment and Testing Library. Test files live next to the
code they cover as `*.test.ts(x)`. Phase 4 eval fixtures live in `tests/fixtures/` and
`tests/evals/` (spec §48). See `docs/PROJECT_SPEC.md` §50–52 for the full test plan
(MIME parsing, encryption, reconciliation, idempotency, etc.) added in later phases.

## Cron configuration

A single global dispatcher (`GET`/`POST` `/api/cron/scan-dispatcher`) selects due Gmail
connections (`next_scan_at <= now()`), claims them with a job lease, and runs incremental
scans. It is protected by `CRON_SECRET` (`Authorization: Bearer …` or `x-cron-secret`) and
must never be publicly executable. `vercel.json` schedules it hourly so daily 08:00
Asia/Jerusalem (and bounded retries) are picked up. Apply `0007_scan_scheduling.sql` before
relying on scheduled scans.

## Deployment

Deploy on Vercel. Configure all environment variables in the project settings and add the cron
schedule. Ensure `GOOGLE_REDIRECT_URI` and `NEXT_PUBLIC_APP_URL` match the deployed domain.

If you deploy on the Vercel Hobby plan, function durations must stay at or below 300 seconds and
built-in cron jobs are limited to once per day. More frequent scheduler triggers require Vercel Pro
or an external scheduler that calls the dispatcher endpoint securely.

## OAuth production considerations

`gmail.modify` is a sensitive/restricted Gmail scope. Before a public launch you must complete
Google's OAuth verification, publish a privacy policy (and terms if required), clearly explain
Gmail data use, request the minimum scope, and review Google's restricted-scope/security-assessment
requirements for your deployment. See spec §38.

## Troubleshooting

- **App fails to start complaining about environment variables:** a server feature needs a secret
  that isn't set. Fill in `.env.local` from `.env.example`.
- **Supabase/Google/Gemini calls fail:** verify the corresponding keys. For Gmail OAuth, the
  redirect URI must match the OAuth client exactly. For Gemini, confirm `GEMINI_API_KEY` and
  `GEMINI_MODEL`.
- **Type or lint errors after adding code:** run `npm run typecheck` and `npm run lint` locally.

## Security notes

Never log email bodies, OAuth tokens, authorization codes, or API keys. Refresh tokens are stored
encrypted server-side and never returned to the client. See spec §37 for the full policy.
