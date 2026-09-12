# MailPilot Improvement Review Brief

## Purpose

This document is a review brief for Cursor. It contains improvement ideas based on the current MailPilot repository, its product specification, and a local verification run.

Cursor should **inspect, challenge, refine, and prioritize** these ideas. Do not assume every proposal is correct. Compare each item against the current implementation and the authoritative product documents:

1. `docs/PROJECT_SPEC.md`
2. `docs/PRODUCT_DECISIONS.md` — wins when it conflicts with the main specification
3. `AGENTS.md`

This is initially an **analysis task, not an implementation task**. Do not edit code until the owner selects an approved implementation phase.

## Instructions for Cursor

1. Read the three source-of-truth files above completely.
2. Inspect the relevant current code and migrations before agreeing with a finding.
3. Preserve the existing uncommitted work. Start with `git status --short` and review overlapping diffs.
4. For every proposal below, classify it as:
   - `Confirmed gap`
   - `Partially implemented`
   - `Already implemented`
   - `Not recommended`
   - `Needs owner decision`
5. Cite the exact supporting file and line numbers.
6. Look for important improvements missing from this document.
7. Separate correctness blockers from product enhancements and visual polish.
8. Identify dependencies, migration requirements, regression risks, and tests needed.
9. Recommend the smallest reliable implementation order.
10. Do not install packages, modify files, deploy, or change live Supabase/Google/Vercel configuration during this review.

## Current Evidence

The following was observed during the review on 2026-09-12:

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- Unit tests: five observed failures involving paid receipts, application follow-ups, and date formatting.
- `npm run format:check`: failed and reported style differences in 196 files.
- Landing and sign-in screens were visually inspected locally.
- The authenticated dashboard/mail/action flow was not visually verified during this review.
- Existing uncommitted dispatcher work was present and was not modified.

Cursor must rerun relevant checks because repository state may have changed.

## Recommended Product Direction

The next milestone should be **trustworthy daily use**, not adding broad new surface area.

The system should reliably answer:

1. What happened?
2. What do I need to do?
3. What am I waiting for?

The recommended sequence is:

```text
Correctness -> measurable quality -> recovery -> user trust -> production operations -> new features
```

## P0: Correctness and Data-Loss Risks

### 1. Partial-scan checkpoint safety

Review `src/lib/scans/process-scan.ts` carefully.

Potential issue: a scan can become `PARTIAL` after individual thread failures but still store a new Gmail history ID and `last_successful_scan_at`. This may cause later incremental scans to skip failed threads or mail that arrived during processing.

Evaluate and propose:

- A fixed history boundary captured before processing.
- Checkpoint advancement only when it is safe.
- Durable storage of failed thread IDs.
- Targeted retry of failed work.
- Regression tests for partial failure, retry, and messages arriving during a scan.

### 2. Atomic scan admission

Potential issue: checking for an existing running scan and then inserting another scan is not one atomic operation. Concurrent manual requests may both pass the check.

Evaluate:

- A database claim function or transaction.
- A partial unique constraint for one active scan per Gmail connection.
- Consistent locking between manual and scheduled scans.
- Behavior after an expired lease.

### 3. Stabilize deterministic classification precedence

The currently observed failing cases are near important product boundaries:

- Paid receipt versus unpaid invoice.
- Application acknowledgment versus assessment/interview request.
- Non-task notices versus explicit user-owned actions.

Review `src/lib/ai/notices.ts` and `src/lib/ai/post-process.ts`. Consider an explicit decision pipeline:

1. Security or critical-account action.
2. Explicit unpaid/failed-payment action.
3. Explicit user-owned action.
4. Waiting state.
5. Paid receipt or routine confirmation.
6. Informational update.
7. Ignore/noise.

Confirm whether this order matches `PRODUCT_DECISIONS.md`. Recommend a clearer structure if overlapping regex helpers currently determine precedence indirectly.

### 4. Durable per-thread failure recovery

Do not reduce thread failures to a counter only. Consider a durable work record containing:

- Scan ID.
- Gmail thread ID.
- Current processing stage.
- Sanitized error code.
- Attempt count.
- Next retry time.
- Final disposition.

Suggested stages:

```text
DISCOVERED -> FETCHED -> ANALYZED -> STORED -> LABELED -> COMPLETE
```

Cursor should decide whether this needs a new table or can safely reuse `scan_jobs`.

### 5. Database and migration truth

The migration folder contains later migrations, while the README migration list was observed to stop at `0003`.

Review:

- README migration instructions.
- Deployed-versus-local migration verification.
- Database constraints for enums, confidence, counters, and valid state combinations.
- RLS and grants on every exposed table/view.
- Private `SECURITY DEFINER` functions and explicit execute permissions.

## P1: Classification Quality and Evaluation

### 6. Build an evaluation scorecard

JSON validity is not enough. Add measurable product metrics:

- Open-task precision and recall.
- Waiting-state accuracy.
- Ignore false-positive rate.
- Security-alert false-negative rate.
- Paid-versus-unpaid payment accuracy.
- Category accuracy.
- Deadline extraction precision.
- Action-type accuracy.
- Hebrew and mixed-language performance.

Use risk-weighted metrics. Ignoring a real security alert should cost much more than putting a newsletter in Summary.

### 7. Expand the evaluation corpus

Build an anonymized set of roughly 200–500 representative cases over time. Include:

- Hebrew, English, and mixed-language threads.
- Long and forwarded threads.
- CC-only assignments.
- Gmail aliases and self-sent mail.
- OTP versus security alert.
- Paid receipt versus amount still due.
- Job receipt versus assessment/interview request.
- Out-of-office and support acknowledgments.
- Attachment-only requests.
- Prompt injection inside email content.
- Changed or canceled deadlines.

Keep fixtures reviewable and expected labels owner-approved.

### 8. Calibrate confidence

Verify whether confidence bands correlate with real correction rates. Consider:

- Reliability diagrams or bucketed accuracy.
- A `needs review` queue.
- Avoiding Gmail label changes below a configurable threshold.
- Tracking confidence before and after deterministic post-processing.

### 9. Turn feedback into useful correction

Current feedback appears intended for future evaluation and may not change the current classification.

Consider allowing the user to:

- Choose the correct destination: Open, Waiting, Summary, Ignore, or Completed.
- Correct category, urgency, deadline, and action type.
- Apply the correction immediately.
- Preserve it as a manual override.
- Store the original prediction and corrected value for evaluation.

Define when a new inbound message is allowed to reopen a manually corrected thread.

### 10. Version the complete classifier

Record more than the prompt version:

- Provider and model.
- Prompt version.
- JSON schema version.
- Context-builder version.
- Deterministic-rule version.
- User-preference version.

This enables safe reprocessing and meaningful evaluation comparisons.

### 11. Provider resilience without unnecessary cost

Keep domain code provider-neutral. Explore a free-tier or local fallback only if it improves reliability without creating excessive complexity.

Required properties:

- Strict independent timeouts.
- Bounded retries.
- Circuit breaker per provider.
- Bounded concurrency and context.
- No retry storm across providers.
- Explicit record of which provider produced a classification.

## P1: Gmail and Scan Reliability

### 12. Fixed Gmail history boundary

Capture the Gmail history boundary before a scan processes its discovered work. Mail arriving afterward should remain available for the next incremental scan.

### 13. Separate analysis persistence from Gmail label mutation

Track these outcomes independently. A thread may be correctly analyzed and stored while Gmail label mutation fails. Retry only the failed stage.

### 14. Lease renewal and serverless duration

Review the uncommitted dispatcher changes carefully. The observed proposed lease duration matched the 300-second function maximum, leaving little recovery margin.

Evaluate:

- A shorter processing budget than the function maximum.
- Lease heartbeat/renewal.
- Safe release only by the owning worker.
- Fencing tokens so an expired worker cannot overwrite a newer worker.
- Resumable chunking rather than one long invocation.

### 15. Chunk and resume large scans

Limit each invocation by both thread count and remaining wall-clock budget. Persist a continuation cursor or pending work set.

### 16. Handle full Gmail History behavior

Confirm support and tests for:

- Pagination.
- Duplicate events.
- Deleted messages or threads.
- Trash movement.
- User removal of MailPilot labels.
- Label-only changes.
- Stale history recovery.
- Empty history responses.

### 17. Discover user aliases

Using only the connected Gmail address may misclassify mail sent through aliases. Evaluate the Gmail `sendAs` data or an owner-configurable alias list and feed all recognized addresses to direction classification.

### 18. Reconciliation scans

Consider a low-frequency bounded reconciliation job that checks for missed history, deleted threads, label drift, and stale database state without repeatedly scanning the entire mailbox.

### 19. Honest progress reporting

Progress should distinguish:

- Discovering mail.
- Fetching threads.
- Waiting for Gmail quota.
- Waiting for AI.
- Storing results.
- Updating Gmail labels.
- Retrying failures.
- Partially completed.

Avoid showing 100% when required retry work remains.

## P1: User Trust and Daily Workflow

### 20. First-run preview mode

Analyze a small sample without changing Gmail labels. Show proposed results and let the user approve full automation.

### 21. Gmail mutation safety level

Offer a clear setting:

- Analyze only.
- Apply only `MailPilot/Processed`.
- Apply all managed MailPilot labels.

### 22. “Why is this here?”

Every thread card should explain the decisive reason for its placement and offer a one-click correction. Avoid exposing hidden chain-of-thought; show concise evidence and rule-level explanation only.

### 23. Change-focused daily dashboard

Prioritize:

- New actions since the last successful scan.
- Urgent and overdue actions.
- Reopened actions.
- Newly resolved threads.
- Waiting items becoming stale.
- Partial scan or connection problems.

“3 new actions, 2 resolved, 1 reopened” is more actionable than totals alone.

### 24. Stronger action workflow

Consider:

- Undo after Complete/Ignore/Snooze.
- Custom snooze date.
- Editable `waiting for` value.
- Stale-waiting reminders.
- Bulk actions.
- Keyboard shortcuts.
- Saved filters.
- Low-confidence filter.

### 25. Email digest delivery

The owner decisions mention dashboard and email digest, while current status describes in-app digest only. Treat delivery as an explicit owner decision and implementation phase.

If approved, it should be:

- Opt-in.
- Configurable by schedule.
- Concise and action-focused.
- Free-tier friendly.
- Idempotent.
- Safe against duplicate delivery.
- Equipped with unsubscribe/disable controls.

### 26. Account lifecycle

Verify and complete:

- Forgot password.
- Email confirmation messaging.
- Gmail reconnect.
- Gmail disconnect.
- Delete stored Gmail-derived data.
- Delete MailPilot account.
- Optional export of classifications/actions.

Disconnecting Gmail is not the same as deleting retained data.

## P2: UX and Accessibility

### 27. Landing page proof

The landing page has a strong message and hierarchy. Improve proof by moving a realistic product example higher and making Summary, Open, and Waiting visibly distinct.

### 28. Sign-in flow completeness

Review:

- Forgot-password link.
- Password visibility control.
- Field-level validation.
- Loading/error state placement.
- Sign-up confirmation state.
- Clear return path.

### 29. Accessibility verification

Test rather than assume:

- Full keyboard navigation.
- Visible focus states.
- Screen-reader names and reading order.
- Live announcements for scan progress and action changes.
- Contrast in light and dark themes.
- Touch target sizes.
- 320px responsive reflow.
- 200% zoom.
- Reduced-motion behavior.

### 30. Empty, error, and recovery states

Create explicit designs for:

- No Gmail connected.
- First scan not started.
- Scan running.
- Gmail quota wait.
- Partial scan.
- Gemini unavailable.
- Gmail reauthorization required.
- No open actions.
- No digest yet.
- Migration/configuration missing.

## P1/P2: Security and Privacy

### 31. Data deletion and retention

Define retention periods and implement deletion for:

- Message snippets and metadata.
- Thread classifications.
- Action items.
- Digests.
- Feedback.
- Scan logs/errors.
- OAuth state and encrypted tokens.

### 32. Token encryption rotation

Store an encryption-key version and support decrypt-with-old/re-encrypt-with-new. Never expose keys or token material to browser code or logs.

### 33. Minimize selected columns

Prefer explicit safe projections over `select("*")`, especially when using a service-role client. Confirm every query filters by authenticated ownership.

### 34. API protection

Review state-changing routes for:

- Authentication.
- Object-level authorization.
- Zod validation.
- CSRF/origin defense in depth.
- Per-user rate limiting.
- Safe error responses.
- Request body limits.

### 35. Sanitized errors and logs

Use structured error codes and correlation IDs. Never log bodies, snippets, OAuth tokens, authorization codes, API keys, or sensitive provider payloads.

### 36. Automated Supabase checks

Add a release check for:

- RLS enabled on exposed tables.
- Ownership predicates in policies.
- Safe views using `security_invoker` where applicable.
- Grants to `anon`, `authenticated`, and `service_role`.
- `SECURITY DEFINER` function placement, search path, and execute grants.
- Database advisors when available.

## P1/P2: Engineering and Operations

### 37. End-to-end tests

There is no observed `test:e2e` script. Add focused flows for:

- Sign-up/sign-in/recovery.
- Gmail disconnected state.
- Scan start and progress polling.
- Successful and partial scan completion.
- Correct Summary/Open/Waiting/Ignored placement.
- Complete/snooze/reopen transitions.
- Reauthorization.
- Settings persistence.

External APIs should use controlled test doubles where appropriate.

### 38. Generated database types

Generate and use Supabase types to reduce broad casts from `unknown` and catch schema drift during typecheck.

### 39. Observability

Track at minimum:

- Scan success/partial/failure rate.
- Duration percentiles.
- Threads processed per scan.
- Failures by stage.
- Gmail quota waiting time.
- AI latency, timeout, and retry rate.
- Label mutation failures.
- Stale/expired leases.
- Classification distribution changes.
- User correction rate.

### 40. Correlation IDs

Carry a scan/job/request identifier across dispatcher, Gmail, AI, database, and digest operations.

### 41. CI quality gates

Recommended gates:

- Format check.
- Lint.
- Typecheck.
- Unit tests.
- Production build.
- Migration/schema checks.
- RLS/security checks.
- Small deterministic classification evaluation threshold.
- Optional end-to-end smoke test.

### 42. Resolve formatting baseline

Apply one dedicated formatting-only change after preserving user work, then enforce formatting in CI. Do not mix a 196-file formatting rewrite into functional fixes.

### 43. Documentation consistency

Update README setup, migration order, current phases, cron limitations, Gmail verification requirements, and troubleshooting. Consider deriving status from one maintained source to reduce drift.

### 44. Database constraints

Evaluate check constraints for:

- Thread status.
- Importance.
- Urgency.
- Action type/status.
- Scan/job status.
- Confidence between 0 and 1.
- Non-negative counters.
- Valid action/status combinations.

### 45. Do not hide database failures as empty inboxes

Queries that return an empty array after a database error can make an outage look like “no mail.” Return a controlled error state and show it in the UI.

## Suggested Implementation Sequence

### Phase A — Correctness baseline

- Resolve the five failing tests.
- Fix partial-scan checkpoint semantics.
- Make scan admission atomic.
- Persist and retry failed thread work.
- Correct migration/setup documentation.
- Add regression tests for these changes.

### Phase B — Measurable classification quality

- Define owner-approved evaluation labels.
- Expand fixtures.
- Add risk-weighted metrics.
- Calibrate confidence.
- Add immediate correction/manual overrides.

### Phase C — Resumable production execution

- Chunk scans.
- Add stage-level persistence.
- Add lease renewal/fencing.
- Separate label retries.
- Add operational telemetry and alerts.

### Phase D — User trust and product completion

- Preview mode.
- Gmail mutation safety setting.
- Better explanation/correction UX.
- Account data deletion.
- Password recovery.
- Email digest if owner-approved.

### Phase E — Release confidence

- End-to-end tests.
- Accessibility verification.
- Supabase security/advisor checks.
- CI evaluation threshold.
- Production readiness checklist.

## Required Cursor Output

Return a concise but evidence-backed report with these sections:

1. **Executive verdict** — Is MailPilot safe for personal daily use now? Why or why not?
2. **Confirmed P0 findings** — Exact file/line evidence and real failure mode.
3. **Disagreements or corrections** — Which ideas in this document are wrong, outdated, or already solved?
4. **Missing improvements** — Important issues not listed here.
5. **Prioritized backlog** — P0/P1/P2, effort, dependencies, and risk.
6. **Recommended first implementation batch** — Smallest coherent batch, exact files likely affected, migrations, and tests.
7. **Verification plan** — Exact existing commands plus any targeted tests that should be added.
8. **Owner decisions required** — Only decisions that materially change product behavior or scope.

Use a table like this for the backlog:

| Priority | Finding | Evidence | User impact | Proposed change | Tests | Effort | Risk |
| -------- | ------- | -------- | ----------- | --------------- | ----- | ------ | ---- |

Do not describe architecture generically. Focus on what is broken, risky, missing, or disproportionately valuable to improve.
