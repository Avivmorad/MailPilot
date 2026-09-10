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

Built **phase by phase** (spec §63). This repository contains **Phase 0 — Bootstrap** (Next.js
App Router, TypeScript strict, Tailwind CSS v4, shadcn/ui, Supabase client/server scaffolding, Zod
environment validation, ESLint + Prettier, a Vitest test setup, and a landing page) plus initial
**Phase 1 — Auth + DB** scaffolding: a `profiles` migration with Row Level Security, Supabase
session middleware, a `/login` page (email + password), and a protected `/dashboard`. Gmail and AI
functionality are **not** implemented yet.

Phase 1 auth requires a configured Supabase project in `.env.local` to run end-to-end; the public
landing page works without any secrets.

## Architecture

- **Frontend:** Next.js (App Router) + React + TypeScript + Tailwind CSS + shadcn/ui.
- **Backend:** Next.js Route Handlers / server-side services under `src/lib/**`.
- **Database:** Supabase PostgreSQL (with Row Level Security).
- **Auth:** Supabase Auth for the app account; a separate Google OAuth flow for Gmail authorization.
- **AI:** OpenAI with strict Structured Outputs, validated with Zod.
- **Scheduler:** a single global cron dispatcher that claims due connections (not per-user cron).
- **Hosting:** Vercel.

## Prerequisites

- Node.js 22+ and npm.
- A Supabase project (for Phase 1+).
- A Google Cloud project with the Gmail API enabled and OAuth credentials (for Phase 2+).
- An OpenAI API key (for Phase 4+).

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
| `OPENAI_API_KEY` / `OPENAI_MODEL`                                                       | OpenAI access; model is configurable, not hard-coded.   |
| `CRON_SECRET`                                                                           | Protects the cron dispatcher endpoint.                  |
| `MAX_THREAD_MESSAGES` / `MAX_MESSAGE_CHARS` / `MAX_THREAD_CHARS` / `AI_MAX_CONCURRENCY` | Context and cost controls.                              |

## Supabase setup

1. Create a Supabase project and copy its URL and keys into `.env.local`.
2. Database schema is managed via migrations in `supabase/migrations` (added from Phase 1).
3. Row Level Security is required on all user-accessible tables (`user_id = auth.uid()`).

## Google Cloud / Gmail setup

1. Create a Google Cloud project and enable the **Gmail API**.
2. Configure the OAuth consent screen and create OAuth client credentials.
3. Use the minimum scope required: `https://www.googleapis.com/auth/gmail.modify`.
4. Set the authorized redirect URI to match `GOOGLE_REDIRECT_URI`.

## Migrations

Supabase migrations live in `supabase/migrations` and are committed to the repository.
(No migrations exist yet in Phase 0.)

## Running & scripts

```bash
npm run dev         # start the dev server
npm run build       # production build
npm run start       # run the production build
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm test            # Vitest (run once)
npm run test:watch  # Vitest (watch mode)
npm run format      # Prettier write
```

## Testing

Unit tests use Vitest with a jsdom environment and Testing Library. Test files live next to the
code they cover as `*.test.ts(x)`. See `docs/PROJECT_SPEC.md` §50–52 for the full test plan
(MIME parsing, encryption, reconciliation, idempotency, etc.) added in later phases.

## Cron configuration

A single global dispatcher endpoint (`POST /api/cron/scan-dispatcher`, added in Phase 8) selects
due Gmail connections and processes them. It is protected by `CRON_SECRET` and must never be
publicly executable. On Vercel, schedule it via `vercel.json` cron.

## Deployment

Deploy on Vercel. Configure all environment variables in the project settings and add the cron
schedule. Ensure `GOOGLE_REDIRECT_URI` and `NEXT_PUBLIC_APP_URL` match the deployed domain.

## OAuth production considerations

`gmail.modify` is a sensitive/restricted Gmail scope. Before a public launch you must complete
Google's OAuth verification, publish a privacy policy (and terms if required), clearly explain
Gmail data use, request the minimum scope, and review Google's restricted-scope/security-assessment
requirements for your deployment. See spec §38.

## Troubleshooting

- **App fails to start complaining about environment variables:** a server feature needs a secret
  that isn't set. Fill in `.env.local` from `.env.example`.
- **Supabase/Google/OpenAI calls fail:** verify the corresponding keys and, for Google, that the
  redirect URI exactly matches your OAuth client configuration.
- **Type or lint errors after adding code:** run `npm run typecheck` and `npm run lint` locally.

## Security notes

Never log email bodies, OAuth tokens, authorization codes, or API keys. Refresh tokens are stored
encrypted server-side and never returned to the client. See spec §37 for the full policy.
