# Owner tasks (cannot be done by the agent)

These are console / legal / live-environment steps. Code for Phases 0–9 plus scan chunk resume is already on `main`. Check each item off in the live project.

## Do first (production can break without this)

- [ ] **Apply Supabase SQL** in the SQL Editor, in order, if any are missing. Newest required files:
  - `supabase/migrations/0011_check_constraints.sql`
  - `supabase/migrations/0012_scan_chunk_resume.sql` (needed for large Scan now lookbacks on Vercel Hobby)
  - Also confirm `0007`–`0010` if this project was set up before those landed.
- [ ] **Confirm Vercel env** matches `.env.example`: `GOOGLE_REDIRECT_URI` and `NEXT_PUBLIC_APP_URL` use the live domain, `CRON_SECRET` matches the cron header, `TOKEN_ENCRYPTION_KEY` is a 32-byte hex key.
- [ ] **Google Cloud OAuth:** authorized redirect URI is exactly `https://<your-domain>/api/gmail/callback`. Gmail API enabled. Your Gmail is a test user while the app is in Testing.

## Google sign-in (MailPilot account, not Gmail)

Two Google callbacks are required and different:

1. **Supabase Auth** — `https://kssolktnbxjppyqmodck.supabase.co/auth/v1/callback` (Continue with Google).
2. **MailPilot Gmail** — `https://gmailpilot.vercel.app/api/gmail/callback` (Connect Gmail). Do not remove it.

- [ ] Keep both Gmail redirect URIs (`http://localhost:3000/api/gmail/callback` and production `/api/gmail/callback`).
- [ ] Add the Supabase Auth redirect URI above on the **same** OAuth Web client.
- [ ] Supabase **mailpilot-dev** → Authentication → Providers → Google: enable; paste client ID and secret (never commit the secret).
- [ ] Authentication → URL Configuration:
  - **Site URL:** `https://gmailpilot.vercel.app` (not the `*-avivmoradteam.vercel.app` alias).
  - **Redirect URLs** (add all):
    - `http://localhost:3000/auth/confirm`
    - `https://gmailpilot.vercel.app/auth/confirm`
    - `https://gmailpilot-avivmoradteam.vercel.app/auth/confirm`
- [ ] Live test: sign out on `https://gmailpilot.vercel.app` → Continue with Google → `/onboarding` on **that same host** → Gmail still disconnected until Connect Gmail.
- [ ] Same verified email as an existing password user: confirm this does **not** duplicate application data (one `auth.users` id / one `profiles` row). Report linking truthfully from what Supabase actually does (automatic identity linking vs a second user). Do not assume linking without checking Authentication → Users.

## Staging walkthrough (T12)

On [the live app](https://gmailpilot.vercel.app):

- [ ] Sign up / sign in (MailPilot account, not Gmail yet).
- [ ] Connect Gmail and complete a Scan now (try 7 days, then a longer window if you have a large inbox).
- [ ] Confirm Mail tabs: Open vs Summary vs Ignored; labels `MailPilot/*` appear in Gmail.
- [ ] Confirm a second scan is incremental (no duplicate threads/actions).
- [ ] Revoke Gmail access in Google Account settings, then use reconnect.
- [ ] Disconnect Gmail; optional: delete analysis data / account.

## Before a public launch (not needed for you-only testing)

- [ ] Privacy policy and a short Gmail data-use page (restricted `gmail.modify` scope).
- [ ] Google OAuth verification / restricted-scope review.
- [ ] Terms of service if you will have users beyond testers.
- [ ] Optional: custom SMTP so signup mail is from MailPilot, not “Supabase Auth” (`docs/PRODUCT_DECISIONS.md`).

## Not owner work

Dependency bumps and app bugs stay in GitHub PRs. Open Dependabot PRs were already merged. Optional later: `next` 16.3.5, `googleapis` 180 — an agent can take those.
