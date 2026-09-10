# Product Decisions (overlay on PROJECT_SPEC.md)

This document records concrete product decisions made by the project owner. It is an **overlay**
on [`PROJECT_SPEC.md`](PROJECT_SPEC.md): where a decision here differs from the spec, the decision
here wins, but the spec remains the source of truth for everything not restated here. Future phases
must follow these.

## Naming

- **Product name:** MailPilot. (The spec was written under the temporary name "Inbox Triage AI".)

## MVP operating defaults

| Decision             | Choice                                                    |
| -------------------- | --------------------------------------------------------- |
| Users                | Multi-user architecture; test with a single user for now  |
| Automatic scan       | Once daily at **08:00**                                   |
| Timezone             | **Asia/Jerusalem**                                        |
| Initial scan window  | Choose **1 / 2 / 3 / 4 days, 1 / 2 / 3 weeks, or 1 month** (default **7 days**) |
| Subsequent scans     | Only changes since the last successful scan (incremental) |
| Summary language     | **English**                                               |
| Presentation         | Dashboard **and** an email digest                         |
| Email body retention | Do **not** persist full email bodies long-term            |
| Sending replies      | The system **never** sends replies on the user's behalf   |

These map onto the spec as follows:

- Daily 08:00 + Asia/Jerusalem → `user_triage_settings.daily_scan_time = '08:00'`,
  `timezone = 'Asia/Jerusalem'`, `scan_interval_minutes = null` (spec §8, §16.4).
- Last 7 days default; manual Scan now can use 1, 2, 3, 4, 7, 14, 21, or 30 days
  (`initial_lookback_days` / Gmail `newer_than`, spec §7.1 / §16.4).
- Manual Scan now shows a live progress bar (conversations checked / total and percent).
  Totals are unique Gmail threads in the window, stored on `scan_runs.threads_discovered`
  and `scan_runs.threads_checked`.
- Gmail calls use a rolling one-minute unit budget (default 12,000 of Google's ~15,000
  units/user/minute). When the budget is full the scan pauses until the oldest units
  expire, then continues. Scan now returns immediately and keeps running in the background.
- Incremental since last success → Gmail History API incremental sync (spec §7.2).
- English summaries → the AI summary/`short_display_title` fields are produced in English; the
  structured enum values (status/importance/etc.) stay in English as defined by the schema (spec §12).
- No long-term body storage → privacy-first default already in spec §2.5 / §16.6.
- Never auto-send → spec §3 "not in MVP" and §68.5.

## Gmail labels

Product-facing label names use the **`MailPilot/`** namespace instead of the spec's `AI/*`:

| Purpose         | Label                       | Spec equivalent (§6)       |
| --------------- | --------------------------- | -------------------------- |
| Important       | `MailPilot/Important`       | `AI/Important`             |
| Action required | `MailPilot/Action Required` | `AI/Action` (+ `AI/Reply`) |
| Low priority    | `MailPilot/Low Priority`    | `AI/Info` / `AI/Ignore`    |
| Processed       | `MailPilot/Processed`       | `AI/Processed`             |

Rules:

- A single email/thread may carry **more than one** label
  (e.g. `MailPilot/Important` + `MailPilot/Action Required` + `MailPilot/Processed`).
- The system **creates the labels if they are missing** on first connect, stores the
  `logical_name -> gmail_label_id` mapping (spec §6/§16.3), and never modifies user labels
  outside the `MailPilot/` namespace.

> Note: this is a simplified product-facing label set. The spec's richer state model
> (`waiting`, `reply`, etc.) is still tracked in the database; the reduced Gmail label set is a
> presentation decision. If the finer-grained Gmail labels are wanted later, revisit this.

## Environment variable naming

The repository uses the variable names defined in [`../.env.example`](../.env.example) and validated
in `src/lib/config/env.ts`. Some setup guides used different illustrative names; the mapping is:

| Guide name (illustrative)              | Actual project variable                         |
| -------------------------------------- | ----------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `NEXT_PUBLIC_SUPABASE_ANON_KEY`                 |
| `SUPABASE_SECRET_KEY`                  | `SUPABASE_SERVICE_ROLE_KEY`                     |
| `OPENAI_API_KEY`                       | `GEMINI_API_KEY`                                |
| `OPENAI_MODEL`                         | `GEMINI_MODEL`                                  |

## AI provider

The project uses **Google Gemini** with JSON Schema structured output
(`responseMimeType: application/json` + `responseJsonSchema`), then Zod +
invariant post-processing. This overrides spec §4/§22/§60, which named OpenAI.

Implementation:

- Env: `GEMINI_API_KEY`, `GEMINI_MODEL` (default in `.env.example`:
  `gemini-3.1-flash-lite`; do not hard-code the model in source).
- Provider class: `GeminiEmailTriageProvider` behind `EmailTriageProvider`
  (spec §60 swap point).
- Domain code must not import `@google/genai` outside `src/lib/ai/client.ts`.
- Gmail labels are applied only after validated analysis (spec §68.8).

## Inbox summary vs open tasks

The dashboard is an overview (scan status and counts). Mail lists live on **Mail** tabs
and stay two separate products (they must not be the same list):

1. **Inbox summary** (Summary tab) — quick updates only (`informational` / `resolved`), grouped by topic:
   login notices, receipts, FYI. **Never** `ignore` (that is the Ignored tab) and never open/waiting tasks.
2. **Open tasks** (Open tab) — only threads where the user still has a durable next step.

One-time auth mail is **not** an open task: OTP / verification codes, magic links, and
“click to verify this email address” are `ignore`. Placement for other families is below.

## Open-task topics

Within Open (and in the summary), group threads under:

| Topic      | Label      | Typical mail                                      |
| ---------- | ---------- | ------------------------------------------------- |
| `security` | Security   | Account / login / session (not OTPs)              |
| `payments` | Payments   | Charges, invoices, receipts                       |
| `general`  | General    | Everything else that is still a real task or FYI  |

Mapping from spec `category`: `account` → security; `finance` / `shopping` → payments;
otherwise general. Similar notices sit together under the same topic in the summary; they
are not merged into a single Gmail thread.

## Placement map

Decide **Open** only when the user still has a durable next step; **Waiting** when they
already did their step; **Summary** when the mail is useful FYI; **Ignore** for noise.
Never persist full email bodies. `action_items` rows exist only for Open (`OPEN`) and
Waiting (`WAITING`).

### Security

| Case | Where | `status` / action |
| ---- | ----- | ----------------- |
| OTP, magic link, confirm-email | Ignore | `ignore` |
| New sign-in / app access granted, and the mail says if this was you do nothing | Summary | `informational` |
| Provider already blocked the login | Summary | `informational` |
| Security copy about a **different** account (this mailbox is only recovery) | Ignore | `ignore` |
| “Secure the account now” with **no** dismiss-if-you path | Open | `action_required` / `review` |
| Password reset, locked/compromised account, unauthorized charge | Open | `action_required` / `review` |

### Payments

| Case | Where | `status` / action |
| ---- | ----- | ----------------- |
| Paid receipt, refund issued, tax/VAT PDF ready to download | Summary | `informational` |
| Bank/account update with no unpaid amount | Summary | `informational` |
| Upcoming renewal or trial started, no charge due | Summary | `informational` |
| Unpaid invoice, failed charge, remaining balance, fine to pay | Open until **that thread** says paid | `action_required` / `pay` |
| Card expired / update payment or service stops | Open | `action_required` / `pay` |
| Marketing that looks like a credit alert | Ignore | `ignore` |

### General

| Case | Where | `status` / action |
| ---- | ----- | ----------------- |
| Person asks to grant access, approve, sign, submit, or answer | Open | matching `action_type` |
| Bounce for mail the user sent | Open | `review` |
| Meeting the user must accept/decline | Open | `schedule` |
| Check-in still needed | Open | `submit` |
| User already asked/sent/signed; no reply yet | Waiting | `waiting` |
| Webinar / mass calendar invite | Summary | `informational` |
| Lab results or “document ready in the portal” | Summary | `informational` |
| Drive/Docs/Dropbox “shared a document/file with you” (access granted) | Summary | `informational` |
| Shipment out for delivery, itinerary, boarding pass, confirmed appointment | Summary | `informational` |
| Job alerts, application auto-acks, bot mail (GitHub/Slack/etc.), surveys, promos | Ignore | `ignore` |
