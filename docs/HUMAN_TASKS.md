# Owner tasks

Console and live checks only. App code through the inbox workspace is on `main`.
Supabase migrations `0007`–`0012` are applied on `mailpilot-dev`. Vercel has the
required env vars. The Gmail redirect URI is
`https://gmailpilot.vercel.app/api/gmail/callback`. Sign-in, Connect Gmail, and
a last-week Scan now already ran on the live app (699 conversations, finished
partial: a few threads were not analyzed).

## Still check on the live app

On [gmailpilot.vercel.app](https://gmailpilot.vercel.app):

- [ ] Mail tabs separate Open, Summary, and Ignored, and Gmail shows `MailPilot/*` labels.
- [ ] A second Scan now is incremental: no duplicate threads or actions.
- [x] Revoke Gmail access in Google Account settings, then reconnect from MailPriority.
- [x] Disconnect Gmail from MailPriority.

## Google sign-in (Continue with Google)

Connect Gmail stays a separate step. Do not remove the Gmail redirect URI above.

- [x] Add authorized redirect URI `https://kssolktnbxjppyqmodck.supabase.co/auth/v1/callback` on the existing Google web client.
- [ ] In Supabase **mailpilot-dev** → Authentication → Providers → Google: enable it and paste that web client id and secret (dashboard only).
- [ ] Authentication → URL Configuration: Site URL is `https://gmailpilot.vercel.app`. Redirect URLs include `http://localhost:3000/auth/confirm`, `http://localhost:3000/**`, and `https://gmailpilot.vercel.app/auth/confirm`.
- [x] Sign out → Continue with Google → land signed in → Gmail still disconnected until Connect Gmail.
- [x] If that Google email already has a password user, confirm Supabase did not create a second user. Check Authentication → Users.

## Before a public launch

- [ ] Google OAuth verification for the restricted Gmail scope (and CASA if Google asks).
- [ ] OAuth consent screen links to `https://gmailpilot.vercel.app/privacy` and `https://gmailpilot.vercel.app/terms`.
