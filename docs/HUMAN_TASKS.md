# Owner tasks (cannot be done by the agent)

These are console / legal / live-environment steps. Code for Phases 0–9 plus scan chunk resume is already on `main`. Check each item off in the live project.

## Do first (production can break without this)

- [ ] **Apply Supabase SQL** in the SQL Editor, in order, if any are missing. Newest required files:
  - `supabase/migrations/0011_check_constraints.sql`
  - `supabase/migrations/0012_scan_chunk_resume.sql` (needed for large Scan now lookbacks on Vercel Hobby)
  - Also confirm `0007`–`0010` if this project was set up before those landed.
- [ ] **Confirm Vercel env** matches `.env.example`: `GOOGLE_REDIRECT_URI` and `NEXT_PUBLIC_APP_URL` use the live domain, `CRON_SECRET` matches the cron header, `TOKEN_ENCRYPTION_KEY` is a 32-byte hex key.
- [ ] **Google Cloud OAuth:** authorized redirect URI is exactly `https://<your-domain>/api/gmail/callback`. Gmail API enabled. Your Gmail is a test user while the app is in Testing.

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

## Google sign-in (MailPilot account, not Gmail)

This is **app authentication** via Supabase Auth. It must not request Gmail scopes. **Connect Gmail** stays a separate step (`gmail.modify` → MailPilot `/api/gmail/callback`).

Both redirect URIs below are required and **different**:

1. **Supabase Auth callback** — Google sends the sign-in code to Supabase (`/auth/v1/callback`). MailPilot then receives a PKCE `code` at `/auth/confirm`.
2. **MailPilot Gmail callback** — Google sends mailbox authorization to this app (`/api/gmail/callback`). Do not replace or remove that URI when adding sign-in.

- [ ] Open the **existing** Google Cloud Console OAuth 2.0 **Web application** client (same client used for Gmail).
- [ ] **Preserve** the existing MailPilot Gmail authorized redirect URI (`http://localhost:3000/api/gmail/callback` and the production `https://<production-domain>/api/gmail/callback`).
- [ ] **Add** authorized redirect URI: `https://kssolktnbxjppyqmodck.supabase.co/auth/v1/callback`
- [ ] In Supabase **mailpilot-dev** → Authentication → Providers → Google: enable the provider and paste that Web client **ID** and **secret**. Never commit the Google client secret (dashboard only; not in git, not in `NEXT_PUBLIC_*`).
- [ ] Authentication → URL Configuration: **Site URL** = the production MailPilot URL. Add Redirect URLs: `http://localhost:3000/auth/confirm` and `https://<production-domain>/auth/confirm`.
- [ ] Live test: sign out → **Continue with Google** → arrive at `/onboarding` signed into MailPilot → Gmail still disconnected until **Connect Gmail** → connect Gmail separately (expect `gmail.modify` consent).
- [ ] Same verified email as an existing password user: confirm this does **not** duplicate application data (one `auth.users` id / one `profiles` row). Report linking truthfully from what Supabase actually does (automatic identity linking vs a second user). Do not assume linking without checking Authentication → Users.

## Not owner work

Dependency bumps and app bugs stay in GitHub PRs. Open Dependabot PRs were already merged. Optional later: `next` 16.3.5, `googleapis` 180 — an agent can take those.
