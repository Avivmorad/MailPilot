# MailPilot Public Launch Roadmap

**Updated:** September 30, 2026  
**Goal:** Any eligible user can create an account, separately authorize Gmail, complete a scan, see trustworthy results, and reliably use MailPilot at the public production URL.

> The landing page is already available at <https://gmailpilot.vercel.app>. The complete signed-in product is not yet verified for unrestricted public use.

This roadmap summarizes the release-critical work from `03-REMAINING-TASKS.md` and `docs/MASTER_PROJECT_PLAN.md`. Those files remain the source for detailed technical task cards.

## How to use this roadmap

- Complete the phases in order.
- Check a task only after its **Done when** and **Verify** sections are satisfied.
- Do not count a local fix, draft PR, or green unit test as deployed production behavior.
- Record the exact commit SHA and environment for every preview and production check.

## Launch status at a glance

| Phase | Goal                    | Tasks   | Status      |
| ----- | ----------------------- | ------- | ----------- |
| 1     | Make launch decisions   | L01–L02 | Not started |
| 2     | Prepare release code    | L03–L07 | In progress |
| 3     | Prove real integrations | L08–L12 | Not started |
| 4     | Release to production   | L13–L14 | Not started |

## Critical path

`L01 → L02 → L06 → L04 → L05 → L08 → L09 → L13 → L14`

Start **L12 Google OAuth verification** as early as possible after L01 and the privacy preparation in L07. Google's external review may determine the launch date.

---

# Phase 1 — Make launch decisions

## [ ] L01 — Define the public launch contract

**Owner:** Project owner  
**Depends on:** None  
**Related work:** DEC-002, DEC-003, DEC-005

Decide and document:

- Public product name and URL
- Who may use the public release
- AI provider, data destinations, and spending limit
- Expected daily scan and recovery time
- Whether the source code will be publicly distributed and needs a license

**Done when:** One written release scope exists and the product makes no unsupported promises about scan speed, free usage, or Gmail access.

**Verify:** Compare the decisions with the product copy and the actual Google, Vercel, Supabase, and AI-provider plans.

## [ ] L02 — Resolve the repository layout conflict

**Owner:** Engineering  
**Depends on:** L01  
**Related work:** DOC-001, DEC-001

The app currently uses `src/` and `supabase/`, while the supplied project instructions require frontend and route code in `client/` and database/backend work in `server/`.

Plan and complete an isolated, behavior-preserving layout change before further implementation in those areas.

**Done when:** The code and project instructions agree on one layout, with working imports, migrations, CI, and Vercel configuration.

**Verify:** Review the move-only diff, then run format, lint, typecheck, tests, and build.

---

# Phase 2 — Prepare release code

## [ ] L03 — Reconcile release branches and fixes

**Owner:** Engineering and reviewer  
**Depends on:** L02  
**Related work:** OPS-004

- Refresh the status of draft PRs #93, #94, and #95.
- Compare the current branch with `main`.
- Keep only reviewed changes required for the release.

**Done when:** No required security, scan, or UX fix exists only in an unmerged branch. The final commit has passed required checks and human review.

**Verify:** Compare exact commit SHAs and diffs, inspect GitHub checks, and review the final release branch after merging.

## [ ] L04 — Diagnose and fix zero-analysis scans

**Owner:** Engineering with Vercel and provider access  
**Depends on:** L01  
**Related work:** TASK-001, BUG-008

Use redacted runtime, AI-provider, Gmail, and database events to find the cause of the reported scans that analyzed zero threads. Fix the demonstrated cause without guessing.

**Done when:** A test scan persists valid analyses, and a real provider failure appears as a failure instead of an empty or normal FYI result.

**Verify:** Reproduce the cause with synthetic data, add a regression test, and run a scan using a disposable Gmail mailbox.

## [ ] L05 — Finish scan recovery and truthful progress

**Owner:** Engineering  
**Depends on:** L04, L06, L10  
**Related work:** BUG-007, TASK-003/004/005, EDGE-001/002/004/006, TEST-007

Ensure that:

- Scans continue after the browser closes.
- Retries and job leases are bounded.
- Interruption does not lose or duplicate work.
- Concurrent requests do not corrupt scan state.
- The UI reflects durable database state.

**Done when:** Interrupted, concurrent, and partially failed scans reach an honest terminal state without duplicate actions or infinite work.

**Verify:** Run fault-injection and real database lease/checkpoint tests. Hard-kill a scan and confirm safe resume with a disposable mailbox.

## [ ] L06 — Prove database isolation and migration safety

**Owner:** Engineering and Supabase owner  
**Depends on:** L02  
**Related work:** TEST-001/002/003, SEC-001/010, OPS-005

- Rehearse fresh and incremental migrations in an isolated database.
- Include `20260929174644_analysis_scan_attribution.sql`.
- Test two-user isolation.
- Fix any direct feedback-write or cross-user access gap.
- Document the recovery procedure.

**Done when:** Every migration applies before its dependent code, two users cannot access or mutate each other's records, and recovery is documented.

**Verify:** Run real SQL and API tests with two test users, compare schemas, and rehearse upgrade and rollback without production data.

## [ ] L07 — Close privacy and security release gates

**Owner:** Engineering and project owner  
**Depends on:** L03, L06  
**Related work:** SEC-002/003/005/006/008/009, TEST-008

Review and fix:

- MIME and message-size limits
- Mutation authorization
- Malicious email and AI output handling
- Browser and log secret exposure
- OAuth token revocation
- Account and analysis-data deletion

**Done when:** No known release-blocking data leak, unauthorized mutation, unbounded ingestion path, or broken deletion flow remains.

**Verify:** Run targeted regression tests, inspect redacted live telemetry, and complete deletion checks with a disposable user.

---

# Phase 3 — Prove real integrations

## [ ] L08 — Verify Gmail and AI behavior end to end

**Owner:** Engineering with consented test Gmail access  
**Depends on:** L04, L05, L06  
**Related work:** TEST-004/005, TASK-006, EDGE-007/008

Test Gmail pagination, History API updates, managed labels, reconnect behavior, quota and error handling, and the selected AI provider.

**Done when:** The first and second scans produce unique threads, correct Open/Summary/Ignored placement, Gmail labels, and an in-app digest. The second scan must be incremental.

**Verify:** Record redacted scan IDs and results, inspect labels in the test mailbox, and run the evaluation scorecard.

## [ ] L09 — Verify the complete signed-in journey

**Owner:** Engineering and QA  
**Depends on:** L05, L07, L08  
**Related work:** TASK-012/013, TEST-006

Walk through:

1. Signup, login, logout, and session recovery
2. Continue with Google for MailPilot identity
3. Separate Connect Gmail authorization
4. Onboarding and Scan now
5. Results, feedback, and settings
6. Mobile, keyboard, zoom, and RTL behavior

**Done when:** The entire journey works with clear loading, error, and empty states. Google identity login must remain separate from Gmail mailbox consent.

**Verify:** Run repeatable authenticated browser checks and a real mobile, 200% zoom, keyboard, and RTL walkthrough.

## [ ] L10 — Verify production configuration and scheduler capacity

**Owner:** Project owner and operations  
**Depends on:** L01  
**Related work:** OPS-002/003

Check:

- Vercel project root and environment-variable names
- Supabase production target
- Google identity and Gmail OAuth callbacks
- Server-only secret placement
- Deployed cron configuration and history
- Number of users one daily dispatcher run can process

**Done when:** Production and test resources are clearly identified, redirects work, and the promised scan schedule is achievable or its limitation is clearly disclosed.

**Verify:** Perform a read-only console inventory and inspect redacted cron history, queue metrics, timezone behavior, DST behavior, and multi-user throughput.

## [ ] L11 — Configure useful, private alerts

**Owner:** Engineering and operations  
**Depends on:** L05, L07, L10  
**Related work:** OPS-006

Add alerts for:

- Zero-success scans
- Stalled jobs
- Failed continuation
- Missed cron runs
- Repeated provider errors

**Done when:** The owner receives actionable alerts without email bodies, OAuth tokens, or user PII.

**Verify:** Trigger synthetic failures and inspect both delivery and payload redaction.

## [ ] L12 — Complete public Google OAuth readiness

**Owner:** Project owner  
**Depends on:** L01, L07, L09  
**Related work:** DEC-005, DOC-003

Complete:

- Verified-domain ownership
- Public homepage, privacy policy, and terms
- Accurate OAuth consent-screen branding
- Least-privilege justification for `gmail.modify`
- Google's restricted-scope verification
- The required security assessment, when applicable

Keep Continue with Google identity login separate from Connect Gmail authorization.

**Done when:** Google permits the intended public audience to authorize Gmail, and the consent text, actual data flow, and privacy policy agree.

**Verify:** Confirm the Google Cloud verification status and complete authorization with a new account that is not configured as a test user.

Useful references:

- [Google Gmail scope list](https://developers.google.com/workspace/gmail/api/auth/scopes)
- [Google restricted-scope readiness](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification)

---

# Phase 4 — Release to production

## [ ] L13 — Prepare the exact release candidate

**Owner:** Engineering, reviewer, and project owner  
**Depends on:** L03, L05, L06, L07, L08, L09, L10, L11, L12  
**Related work:** OPS-001/008, TEST-009

- Investigate any current Vercel preview error.
- Merge the reviewed release commits.
- Run every required project gate.
- Deploy a preview from the exact release commit.
- Record the migration order, rollback target, and known limitations.

**Done when:** CI and the exact preview deployment are green, and the release SHA and rollback target are recorded.

**Verify:** Run:

```text
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run eval:scorecard
npm run build
```

Then inspect the deployment metadata and confirm that it points to the tested SHA.

## [ ] L14 — Deploy and prove production behavior

**Owner:** Project owner and operations  
**Depends on:** L13  
**Related work:** OPS-008, TEST-009

1. Approve the release go/no-go.
2. Apply approved database migrations in order.
3. Deploy the exact tested SHA to the existing Vercel project.
4. Run the complete production smoke test.
5. Keep the rollback target ready.

**Done when:** Production proves sign-in, separate Gmail consent, successful analysis, correct buckets and labels, a second incremental scan, closed-browser recovery, scheduled scanning, and alert delivery.

**Verify:** Record the deployed SHA, redacted scan evidence, cron evidence, alert evidence, owner approval, and rollback target.

---

# External prerequisites

These require the project owner or an external service. They cannot be completed through repository code alone.

## Owner access and decisions

- Approve the L01 launch contract.
- Provide access to redacted Vercel logs, Google Cloud, Supabase, and the existing Vercel project.
- Approve production migrations and the final deployment.

## Disposable test resources

- An isolated Supabase database
- Two test users
- A Gmail test mailbox with explicit consent to add test messages and labels

Do not use a real user's mailbox for destructive or fault-injection tests.

## Google review

`gmail.modify` is a restricted scope. Public consumer access requires verification unless an exception applies. Server access to restricted Gmail data can require a security assessment. Google's review may take weeks, so begin L12 early.

## Scheduler limitation

The repository currently schedules `0 6 * * *`, which runs once each day. Vercel Hobby allows daily cron with hour-level timing precision. The owner must accept that delay and capacity or approve another scheduling option.

[Review Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing)

# Public launch definition of done

MailPilot is ready for public launch only when all of the following are true:

- [ ] All L01–L14 tasks are complete.
- [ ] Google permits the intended public audience to authorize Gmail.
- [ ] The exact production SHA passed every project gate.
- [ ] Required database migrations were safely applied.
- [ ] A new user completed the full production journey.
- [ ] A second scan proved incremental behavior with no duplicates.
- [ ] Scheduled scanning and failure alerts were observed in production.
- [ ] A tested rollback target is recorded.
