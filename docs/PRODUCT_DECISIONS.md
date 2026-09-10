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
| Initial scan window  | **Last 7 days**                                           |
| Subsequent scans     | Only changes since the last successful scan (incremental) |
| Summary language     | **Hebrew**                                                |
| Presentation         | Dashboard **and** an email digest                         |
| Email body retention | Do **not** persist full email bodies long-term            |
| Sending replies      | The system **never** sends replies on the user's behalf   |

These map onto the spec as follows:

- Daily 08:00 + Asia/Jerusalem → `user_triage_settings.daily_scan_time = '08:00'`,
  `timezone = 'Asia/Jerusalem'`, `scan_interval_minutes = null` (spec §8, §16.4).
- Last 7 days → `initial_lookback_days = 7` (spec §16.4).
- Incremental since last success → Gmail History API incremental sync (spec §7.2).
- Hebrew summaries → the AI summary/`short_display_title` fields are produced in Hebrew; the
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
