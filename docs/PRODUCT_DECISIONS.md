# Product Decisions (overlay on PROJECT_SPEC.md)

This document records concrete product decisions made by the project owner. It is an **overlay**
on [`PROJECT_SPEC.md`](PROJECT_SPEC.md): where a decision here differs from the spec, the decision
here wins, but the spec remains the source of truth for everything not restated here. Future phases
must follow these.

## Naming

- **Product name:** MailPilot. (The spec was written under the temporary name "Inbox Triage AI".)

## MVP operating defaults

| Decision             | Choice                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------ |
| Users                | Multi-user architecture; test with a single user for now                                                     |
| Automatic scan       | Once daily at **08:00**                                                                                      |
| Timezone             | **Asia/Jerusalem**                                                                                           |
| Initial scan window  | Choose **1 / 2 / 3 / 4 days, 1 / 2 / 3 weeks, or 1 month** (default **7 days**)                              |
| Subsequent scans     | Only changes since the last successful scan (incremental)                                                    |
| Summary language     | **English**                                                                                                  |
| Presentation         | Dashboard **and** an **in-app** digest (Phase 9); **email** digest delivery is a future extension (spec §72) |
| Email body retention | Do **not** persist full email bodies long-term                                                               |
| Sending replies      | The system **never** sends replies on the user's behalf                                                      |

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
- In-app digest (Phase 9) is generated after each successful or partial scan
  when `digest_enabled` is true (default). Counts come from stored messages and
  threads for the scan window. Top actions are unique by thread. Sending the
  digest by email is still a future extension (spec §72).

## Gmail labels

Product-facing label names use the **`MailPilot/`** namespace instead of the spec's `AI/*`:

| Purpose         | Label                       | Spec equivalent (§6)       |
| --------------- | --------------------------- | -------------------------- |
| Important       | `MailPilot/Important`       | `AI/Important`             |
| Action required | `MailPilot/Action Required` | `AI/Action` (+ `AI/Reply`) |
| Low priority    | `MailPilot/Low Priority`    | `AI/Info` / `AI/Ignore`    |
| Processed       | `MailPilot/Processed`       | `AI/Processed`             |

Rules:

- Every thread has **one canonical `status`** in the database (`action_required`, `waiting`,
  `informational`, `resolved`, or `ignore`). Mail tabs, action workflow, and digests derive from
  this single source of truth — a thread never has two competing statuses.
- Gmail **`MailPilot/*` labels are presentation only**. A single thread may carry **more than
  one** label at once (e.g. `MailPilot/Important` + `MailPilot/Action Required` +
  `MailPilot/Processed`). This intentionally differs from the spec's mutually exclusive `AI/*`
  state labels (§6).
- The system **creates the labels if they are missing** on first connect, stores the
  `logical_name -> gmail_label_id` mapping (spec §6/§16.3), and never modifies user labels
  outside the `MailPilot/` namespace.
- A Gmail inbox (`gmail_email` / Google account id) may be **actively connected to only one
  MailPilot user**. Connecting the same mailbox from a second signup is rejected until the
  first account disconnects it. Apply `0010_gmail_mailbox_uniqueness.sql`.

> Note: this is a simplified product-facing label set. The spec's richer state model
> (`waiting`, `reply`, etc.) is still tracked in the database; the reduced Gmail label set is a
> presentation decision. If the finer-grained Gmail labels are wanted later, revisit this.

## Environment variable naming

The repository uses the variable names defined in [`../.env.example`](../.env.example) and validated
in `src/lib/config/env.ts`. Some setup guides used different illustrative names; the mapping is:

| Guide name (illustrative)              | Actual project variable         |
| -------------------------------------- | ------------------------------- |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `SUPABASE_SECRET_KEY`                  | `SUPABASE_SERVICE_ROLE_KEY`     |
| `OPENAI_API_KEY`                       | `GEMINI_API_KEY`                |
| `OPENAI_MODEL`                         | `GEMINI_MODEL`                  |

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

1. **Inbox summary** (Summary tab) — leftover useful FYI only (`informational` / `resolved`).
   **Never** `ignore` and never open/waiting tasks.
2. **Open tasks** (Open tab) — a real next step, including security events and expired credentials.
3. **Ignored** — OTP/verification, marketing, job alerts, receipts, and routine automated notices.

Placement priority:

1. OTP, verification code, marketing, job alert, receipt, routine confirmation, or automated FYI → `ignore`, unless the mail explicitly requires action.
2. Unrecognized/new-device login, security alert, expired API key/token, deadline, required payment, check-in, or explicit action → `action_required`.
3. Otherwise → `informational`.
4. Status is never empty. `requires_action` is true only for Open.

Mail tabs are derived from this single `status` (plus action workflow for waiting/completed/snoozed). A thread ID cannot appear in both Summary and Ignored.

## Open-task topics

Within Open (and in the summary), group threads by the AI `category`. Use
`other` only when nothing else fits. Headings:

| Category                 | Label                       | Typical mail                                                                       |
| ------------------------ | --------------------------- | ---------------------------------------------------------------------------------- |
| `finance`                | Finance                     | Banking, charges, receipts, invoices, billed subscriptions, investments, tax       |
| `security`               | Security                    | Logins, authentication, passwords, OAuth, account access (not OTPs as Open tasks)  |
| `career`                 | Career                      | Jobs, recruiters, applications, interviews                                         |
| `education`              | Education                   | Courses, exams, school or university enrollment                                    |
| `projects_development`   | Projects & Development      | Code, deployments, developer tooling                                               |
| `travel_transport`       | Travel & Transport          | Flights, hotels, transport, travel insurance                                       |
| `shopping_orders`        | Shopping & Orders           | Orders, deliveries, returns of goods                                               |
| `official_legal`         | Official, Legal & Insurance | Government, contracts, insurance, pension                                          |
| `accounts_subscriptions` | Accounts & Subscriptions    | Service-account notices, plan changes, product updates, non-security subscriptions |
| `personal_health`        | Personal & Health           | Personal messages, appointments, medical, personal services                        |
| `social_feeds`           | Social & Feeds              | Social networks, groups, social notifications                                      |
| `gaming_entertainment`   | Gaming & Entertainment      | Games and entertainment content                                                    |
| `newsletters_promotions` | Newsletters & Promotions    | Promotions, ads, newsletters with no operational content                           |
| `other`                  | Other                       | Default only when none of the above fit                                            |

This replaces the spec §12 category enum (`work`, `school`, `account`, …) and the
previous three UI buckets (Security / Payments / General). Stored legacy values
map onto the new taxonomy at read/group time. Similar notices sit together under
the same heading; they are not merged into a single Gmail thread.

## Placement map

Decide **Open** only when the user still has a durable next step; **Waiting** when they
already did their step; **Summary** when the mail is useful FYI; **Ignore** for noise.
Never persist full email bodies. `action_items` rows exist only for Open (`OPEN`) and
Waiting (`WAITING`).

**Precedence:** classify by the remaining action and who owns it. An automated sender
alone must not cause an actionable request to be ignored. OTP, magic links, and
“verify this email address” stay Ignore (see Security).

### Security

| Case                                                                        | Where  | `status` / action            |
| --------------------------------------------------------------------------- | ------ | ---------------------------- |
| OTP, magic link, confirm-email, “Link verification code”                    | Ignore | `ignore`                     |
| New / unrecognized device login, Google security alert                      | Open   | `action_required` / `review` |
| Expired API key, personal access token, or similar credential               | Open   | `action_required` / `review` |
| Provider already blocked the login                                          | Open   | `action_required` / `review` |
| Security copy about a **different** account (this mailbox is only recovery) | Ignore | `ignore`                     |
| Password reset, locked/compromised account, unauthorized charge             | Open   | `action_required` / `review` |

### Payments

| Case                                                          | Where                                | `status` / action         |
| ------------------------------------------------------------- | ------------------------------------ | ------------------------- |
| Paid receipt, refund issued, tax/VAT PDF ready to download    | Ignore                               | `ignore`                  |
| Bank/account update with no unpaid amount                     | Ignore                               | `ignore`                  |
| Upcoming renewal or trial started, no charge due              | Ignore                               | `ignore`                  |
| Unpaid invoice, failed charge, remaining balance, fine to pay | Open until **that thread** says paid | `action_required` / `pay` |
| Card expired / update payment or service stops                | Open                                 | `action_required` / `pay` |
| Marketing that looks like a credit alert                      | Ignore                               | `ignore`                  |

### General

| Case                                                                                                | Where   | `status` / action            |
| --------------------------------------------------------------------------------------------------- | ------- | ---------------------------- |
| Person or automated mail asks the user to grant access, approve, sign, submit, or answer            | Open    | matching `action_type`       |
| Signature request, approval request, or document comment that explicitly asks the user to act       | Open    | `sign` / `approve` / `reply` |
| Bounce for mail the user sent                                                                       | Open    | `review`                     |
| Meeting the user must accept/decline, or a request to choose/confirm a new time                     | Open    | `schedule`                   |
| Interview scheduling, assessment, or request for missing application documents                      | Open    | `schedule` / `submit`        |
| Parcel collection, address correction, or customs-information request                               | Open    | `follow_up` / `submit`       |
| Check-in still needed                                                                               | Open    | `submit`                     |
| User already asked/sent/signed; no reply yet                                                        | Waiting | `waiting`                    |
| Out-of-office reply or support-ticket acknowledgment while that request is unanswered               | Waiting | `waiting` (not resolved)     |
| Webinar / mass calendar invite                                                                      | Ignore  | `ignore`                     |
| Confirmed meeting reschedule or cancellation (no new time to choose)                                | Summary | `informational`              |
| Lab results or “document ready in the portal”                                                       | Summary | `informational`              |
| Drive/Docs/Dropbox “shared a document/file with you” (access granted)                               | Summary | `informational`              |
| Routine tracking / shipment out for delivery, itinerary, boarding pass, confirmed appointment       | Summary | `informational`              |
| Useful mail that assigns work only to someone else; being CC’d is not a task                        | Summary | `informational`              |
| Job alerts, receipt-only application acknowledgments, bot mail with no user action, surveys, promos | Ignore  | `ignore`                     |

## App-account emails (Supabase Auth)

Signup / magic-link / password-reset mail is sent by **Supabase Auth**, not Gmail and not
MailPilot. Default From is “Supabase Auth” (`noreply@mail.app.supabase.io`) with generic
English templates. Clicking the link still confirms the **MailPilot app account**. Do not
confuse this with **Connect Gmail** (Google OAuth to scan the mailbox).

- **Subject/body:** Authentication → Email → Templates (Confirm signup, Magic Link, Reset
  password). Keep `{{ .ConfirmationURL }}`.
- **From / sender (“source”):** **Set up custom SMTP to edit the source.** Without a
  domain + Custom SMTP (Resend, SendGrid, Google Workspace, etc.), Gmail will keep showing
  Supabase Auth. Sender name MailPilot + a domain address only after SMTP is configured.
  Not required for an internal launch; templates alone change subject and body immediately.
