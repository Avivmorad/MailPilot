# GmailPilot — Ordered Improvement Plan

Work through the following tasks in order. Do not implement everything in one large change.

## General rules

- Inspect relevant files before editing.
- Preserve existing uncommitted changes.
- Complete one task at a time.
- Add regression tests for every behavior change.
- After each task run:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

- Do not continue to the next task until failures caused by the current task are fixed.
- Never expose Gmail content, OAuth tokens, service-role keys, or other secrets.

---

## Phase 1 — Restore a stable baseline

### T1 — Finish the category and tag refactor

Current state:

- 239 of 244 tests pass.
- Five tests fail around paid receipt classification, assessment follow-ups, receipt post-processing, and date formatting.

Required work:

- Fix the implementation according to `docs/PRODUCT_DECISIONS.md`.
- Do not weaken or delete valid tests merely to make them pass.
- Check the new taxonomy and `ThreadTags` integration for incomplete changes.

Done when:

- All unit tests pass.
- Lint and typecheck pass.
- No unused or missing imports remain.

### T2 — Make formatting and production builds deterministic

Required work:

- Run Prettier and normalize the repository formatting.
- Prevent the production build from depending on downloading Google Fonts.
- Prefer self-hosted/local fonts or a reliable system fallback.

Done when:

- `npm run format:check` passes.
- `npm run build` works without access to Google Fonts.
- Lint, typecheck, and tests still pass.

---

## Phase 2 — Improve classification quality

### T3 — Expand the email evaluation suite

Current state:

- Only 25 evaluation fixtures exist.
- The specification expects approximately 50 representative threads.

Add English, Hebrew, and mixed-language scenarios for:

- Paid receipts versus unpaid invoices.
- Security alerts versus OTP messages.
- Job application receipts versus interviews and assessments.
- Waiting acknowledgements and out-of-office replies.
- User reply followed by a new inbound reply.
- Meeting scheduling and confirmed meeting changes.
- Delivery tracking versus collection or customs actions.
- Deadlines and ambiguous relative dates.
- Long and forwarded threads.
- Automated messages containing real user actions.
- Prompt-injection attempts inside email content.

Done when:

- At least 50 useful fixtures exist.
- Structured-output validity is 100%.
- Deadline hallucination is effectively zero.
- Action recall reaches at least 90% on the curated dataset.
- Evaluation results can be generated consistently.

---

## Phase 3 — Complete missing MVP functionality

### T4 — Complete triage settings

Add settings for:

- VIP senders.
- Ignored senders.
- Ignored domains.
- Custom triage instructions.
- Enable or disable digest generation.

Requirements:

- Validate all input with Zod.
- Limit custom instruction length.
- Persist settings in `user_triage_settings`.
- Ensure scans actually apply every setting.
- Never send these values to unrelated users.

Done when:

- Settings save and reload correctly.
- Classification changes according to the saved settings.
- Unit and integration tests cover every setting.

### T5 — Harden Gmail and scan behavior

Required work:

- Change manual scan rate limiting to one scan per two minutes per Gmail connection.
- Handle revoked or expired Gmail tokens as `REAUTH_REQUIRED`.
- Provide a clear reconnect flow.
- Prevent concurrent scans for the same connection.
- Verify Gmail and Gemini retry behavior.
- Show friendly messages for quota, partial-scan, and temporary AI failures.
- Never apply speculative Gmail labels after failed analysis.

Done when:

- Tests cover Gmail 429, Gemini 429/503, revoked tokens, duplicate scan requests, and partial failures.
- The UI never displays raw provider errors.
- Existing summaries remain available after a connection problem.

### T6 — Add privacy and account deletion controls

Implement separate actions for:

1. Delete analysis data.
2. Disconnect Gmail.
3. Delete the entire GmailPilot account.

Requirements:

- Require explicit confirmation for destructive actions.
- Delete only data owned by the authenticated user.
- Deleting analysis data must remove messages, threads, actions, digests, and relevant scan history.
- Account deletion must remove all owned product data.
- Disconnecting Gmail must revoke the token when possible and stop future scans.
- Historical summaries should remain after disconnect unless the user explicitly requests deletion.

Done when:

- Cross-user deletion is impossible.
- Tests verify complete deletion and cascading behavior.
- The UI clearly explains what each operation removes.

---

## Phase 4 — Complete the user journey

### T7 — Build first-time onboarding

Required flow:

```text
Sign up or sign in
→ Connect Gmail
→ Select initial lookback
→ Select daily scan time and timezone
→ Configure optional triage preferences
→ Run the first scan
→ Open the dashboard
```

Requirements:

- Progress must come from real server state.
- The flow must recover from OAuth and scan failures.
- Returning users must not be forced through onboarding again.
- The user must be able to leave and resume safely.

Done when:

- A new user can complete the entire flow without manually navigating between pages.
- A browser test covers the successful flow and major failure states.

---

## Phase 5 — Reliability and verification

### T8 — Add safe observability

Record structured events for:

- Gmail connected or reconnect required.
- Scan started, completed, partial, or failed.
- Thread analyzed.
- Action created or updated.
- Digest created.

Include identifiers, counters, duration, and error type.

Never log:

- Email bodies.
- OAuth tokens.
- Authorization codes.
- API keys.
- Full OAuth callback URLs.

Done when:

- Important production failures can be diagnosed without accessing private email content.
- Automated checks verify that sensitive values are not logged.

### T9 — Add integration and idempotency tests

Create integration tests using mocked Gmail and Gemini services.

Cover:

- Initial scan.
- Second identical scan.
- Incremental scan with no changes.
- One changed thread.
- `OPEN → WAITING → OPEN → COMPLETED`.
- Stale Gmail History ID recovery.
- Existing Gmail labels.
- Duplicate scan requests.
- Partial failures.
- Revoked Gmail token.
- Multi-user isolation and RLS.
- Data deletion.

Mandatory idempotency result after running the same scan twice:

- No duplicate messages.
- No duplicate threads.
- No duplicate actions.
- No duplicate digests.
- No duplicate Gmail labels.

Done when:

- The integration suite passes consistently.
- User A cannot access or modify User B's data.

---

## Phase 6 — UX refinement

### T10 — Review all primary screens

Review:

- Landing page.
- Login and signup.
- Onboarding.
- Dashboard.
- Mail tabs.
- Action cards.
- Thread details.
- Digests.
- Settings.
- Gmail reconnect states.
- Destructive confirmations.

Improve:

- Mobile and desktop layouts.
- Keyboard navigation.
- Focus indicators.
- Loading states.
- Empty states.
- Error states.
- Button feedback.
- Screen-reader labels.
- Long subject and sender handling.
- Hebrew and mixed RTL/LTR content.

Done when:

- Primary flows work on desktop and mobile.
- No page has clipped content or unclear actions.
- Browser tests cover navigation and main interactions.
- Accessibility checks show no critical violations.

---

## Phase 7 — Documentation and release

### T11 — Synchronize documentation

Update documentation so it matches the implementation.

Required corrections:

- Document all seven Supabase migrations in order.
- Update current phase and status information.
- Document cron and deployment configuration.
- Document the complete environment-variable setup.
- Resolve the email-digest contradiction.

Default product decision unless the owner says otherwise:

> MVP includes in-app digests only. Sending digest emails is a future extension.

Done when:

- A developer can set up the project using only the README.
- README, project specification, and product decisions do not contradict each other.

### T12 — Perform staging release verification

Verify in a real staging environment:

- All migrations are applied.
- Environment variables are configured.
- Gmail redirect URLs are correct.
- Cron authentication works.
- Scheduled scans run only for due users.
- Reconnect works after Gmail authorization is revoked.
- No secrets appear in browser responses or logs.
- The complete MVP user journey works end to end.

Before public launch also prepare:

- Privacy policy.
- Gmail data-use explanation.
- Google OAuth verification.
- Terms of service if required.
- Review of Google restricted-scope requirements.

Done when:

- The complete MVP flow passes on staging.
- All automated checks are green.
- No critical security, privacy, or data-loss issue remains.

---

## Execution order

```text
T1
→ T2
→ T3
→ T4 + T5 + T6
→ T7
→ T8
→ T9
→ T10
→ T11
→ T12
```

## First task to execute

Start with **T1 only**.

Inspect the current uncommitted category and tag changes, identify why the five tests fail, fix the implementation according to `docs/PRODUCT_DECISIONS.md`, and run the complete verification suite.

At the end report:

1. Files changed.
2. Root causes found.
3. Tests added or updated.
4. Commands executed and their results.
5. Remaining known issues.
6. Whether T1 is fully complete.
