# MailPilot — Ordered Improvement Plan

**Status (repository, 2026-09):** T1–T11 are implemented on `main`. T12 is
live-environment verification and remains owner work
([`HUMAN_TASKS.md`](HUMAN_TASKS.md)). This file is kept as the historical
ordered plan; do not treat unchecked original wording below T1–T11 as current
backlog.

| Task | Outcome |
| ---- | ------- |
| T1 Category/tag refactor | Shipped; unit tests cover taxonomy and placement. |
| T2 Format + production build | Shipped; `npm run format:check` and self-hosted fonts; CI runs format check. |
| T3 Eval suite ≥50 cases | Shipped; gates in `EVAL_THRESHOLDS` (schema 100%, action recall ≥90%, deadline hallucination 0). |
| T4 Triage settings | Shipped (`user_triage_settings`, Zod, scan applies settings). |
| T5 Gmail/scan hardening | Shipped (rate limit, `REAUTH_REQUIRED`, reconnect, one RUNNING scan, retries, no labels on failed AI). |
| T6 Privacy deletion | Shipped (delete analysis, disconnect Gmail, delete account). |
| T7 Onboarding | Shipped (connect → lookback → daily time → optional prefs → first scan). |
| T8 Observability | Shipped (structured events; no bodies/tokens; Sentry tag allowlist). |
| T9 Integration/idempotency | Shipped (`npm run test:integration`). |
| T10 Primary-screen UX | Shipped in product UI (landing, mail tabs, settings, reconnect, confirmations). Browser a11y/e2e suite is still a later enhancement. |
| T11 Documentation sync | Shipped and maintained in README / spec overlay / this plan. Recruiter README pass: 2026-09. |
| T12 Staging verification | **Not claimed.** Owner walkthrough in `HUMAN_TASKS.md`. Automated CI is green on PRs; that is not a substitute for the live Gmail walkthrough. |

## General rules (still apply to new work)

- Inspect relevant files before editing.
- Complete one task at a time.
- Add regression tests for every behavior change.
- After each task run:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run eval:scorecard
npm run build
```

- Never expose Gmail content, OAuth tokens, service-role keys, or other secrets.

---

## Historical plan (T1–T12 as originally written)

The sections below are the original ordered plan. Use the status table above,
not the “Start with T1 only” closer, to decide what to do next.

### T1 — Finish the category and tag refactor — done

Fix the implementation according to `docs/PRODUCT_DECISIONS.md`. All unit tests,
lint, and typecheck pass.

### T2 — Make formatting and production builds deterministic — done

Prettier baseline; production build does not depend on downloading Google Fonts.

### T3 — Expand the email evaluation suite — done

At least 50 fixtures; structured-output validity 100%; deadline hallucination 0;
action recall ≥ 90% on the curated dataset (`npm run eval:scorecard`).

### T4 — Complete triage settings — done

VIP / ignored senders and domains, custom instructions, digest enable; Zod;
persisted in `user_triage_settings`; applied during scans.

### T5 — Harden Gmail and scan behavior — done

Manual scan rate limit, `REAUTH_REQUIRED` + reconnect, no concurrent scans,
retries, friendly errors, no speculative labels after failed analysis.

### T6 — Add privacy and account deletion controls — done

Delete analysis data, disconnect Gmail, delete MailPilot account.

### T7 — Build first-time onboarding — done

Sign in → Connect Gmail → lookback → daily scan time → optional prefs → first
scan → dashboard. Progress from server state.

### T8 — Add safe observability — done

Structured events for Gmail, scans, threads, actions, digests. No email bodies,
tokens, codes, keys, or full OAuth callback URLs.

### T9 — Add integration and idempotency tests — done

Mocked Gmail + Gemini: initial/identical/incremental scans, action lifecycle,
stale history, labels, duplicates, partial failure, revoked token, RLS, deletion.

### T10 — Review all primary screens — done in product UI

Landing, auth, onboarding, dashboard, Mail tabs, actions, thread details,
digests, settings, reconnect, destructive confirmations. Dedicated e2e/a11y
automation is not part of this completed batch.

### T11 — Synchronize documentation — done

README lists migrations `0001`–`0012`, cron, env vars, in-app digest only.
Product name is MailPilot; the “Inbox Triage AI” working name is archived in
the spec banner.

### T12 — Perform staging release verification — open (owner)

Verify in a real environment: migrations, env, Gmail redirects, cron auth,
scheduled scans, reconnect, no secrets in browser/logs, full MVP journey.
Public launch still needs Google OAuth verification. Checklist:
[`HUMAN_TASKS.md`](HUMAN_TASKS.md).
