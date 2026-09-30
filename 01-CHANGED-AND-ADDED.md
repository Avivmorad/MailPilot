# Changes and verification

EDGE-004 pagination-cycle rejection is on this branch and is being merged with the Actions wording. SEC-003 merged in PR #94. The checkpoints below are historical.

## TASK-002 — Historical-chat inventory checkpoint (2026-09-29)

The supported archived-ChatGPT listing was paginated to its terminal cursor (28 pages); no archived Mail Pilot project chat or new MailPilot/Gmail-scan title appeared. Archived Codex listings likewise ended without a new project requirement. The available 50 recent chats contain the same mapped Mail Pilot/local-project chats. Relevant chat summaries were rechecked against the existing requirements map; no task was added or marked complete from an assistant's old claim. `docs/MASTER_PROJECT_PLAN.md` and the remaining/blocker reports now record the exact coverage boundary: older active chats are not paginated by the available listing and remain unverified. This is progress on TASK-002, not exhaustive completion. Actual model: Codex current session; planned Light/Standard inventory work, actual Standard due complete archive pagination.

## Current checkpoint — SEC-003 (2026-09-29)

The 72-task goal remains active. PR #92 merged to `main` at `f350c93`; its new analysis-attribution SQL migration has **not** been applied or rehearsed in a disposable database. PR #93 (`codex/sec-008-mime-ingestion`, `2439877`) remains draft and unmerged. Its CI/checks passed, but the Cursor review identified the unresolved TASK-005 oversized-thread non-retryable failure path; green CI is not approval or full task acceptance. The Cursor-review heartbeat is active, and C05 still needs an authenticated disposable session/viewport proof. Older handoff statements below are historical.

SEC-003 work is isolated on `codex/sec-003-telemetry-boundary`, based on current `origin/main`, rather than added to PR #93. `src/lib/observability/events.ts` now accepts only the metadata keys used by production event callers and redacts free-form string values. `src/lib/observability/sentry-privacy.ts` reconstructs outbound events from a minimal allowlist, drops nested SDK/request/exception payloads, and accepts only known route templates, tag values and HTTP methods. This sacrifices raw exception stack/message diagnostics to prevent arbitrary email bodies, prompts or provider responses from escaping through nested event fields. The accompanying tests first reproduced two synthetic canary leaks, then passed after the fix. New `src/lib/config/client-boundary.test.ts` traverses transitive local imports from client components and rejects privileged server modules.

Four targeted files passed 33/33 tests. Final local gates passed: `npm run format:check`; `npm run lint`; `npm run typecheck`; `npm test` (570/570 across 103 files); `npm run test:integration` (17/17); `npm run eval:scorecard` (2/2); and `npm run build`. The initial formatting check flagged only the three just-edited root reports; formatting them and rerunning the check passed. A production build with synthetic private-key canaries also passed: no private canary was found in client assets or prerendered HTML/RSC; the intentionally public anon-key control was found in client assets. This is local build evidence, not deployed-browser, live analytics or live Sentry proof. The security-best-practices guidance led to strict outbound allowlists and a synthetic bundle control.

Execution started 2026-09-29. This is a live checkpoint, not a completion claim.

## Resumed execution — TASK-003

The owner explicitly resumed tasks and updates on 2026-09-29 after the PR handoff. The full 72-task plan remains active, not complete. Actual model: Codex current session; recommended profile: frontier coding model, high reasoning / Heavy effort. The existing task and routing tables in `03-REMAINING-TASKS.md` remain authoritative.

- `src/lib/scans/process-scan.ts`: save the current scan's analysis attribution with the validated thread row; recover that count when replay reuses an out-of-prefix analysis. Live progress no longer overwrites durable message counters ahead of the batch checkpoint. Rejected initial/discovery/batch/continuation writes stop execution instead of admitting another batch. The pool's bounded batch barrier is unchanged.
- `src/lib/scans/types.ts`, `src/lib/scans/store.ts`: add optional `analysisScanId` port metadata and map `analysis_scan_id` in the same thread upsert/read as analysis. This is attribution of persisted validated thread results, not a provider-call/billing counter. Legacy analysis stays unattributed; no guessed backfill.
- `supabase/migrations/20260929174644_analysis_scan_attribution.sql`: locally drafted forward migration adds nullable attribution with a scan foreign key (`ON DELETE SET NULL`) and a non-null FK index. No grants/RLS policies changed. Apply and test it in an approved disposable database before deploying this application revision. It has NOT been applied anywhere.
- `supabase/README.md`, `src/lib/scans/errors.ts` / `errors.test.ts`: record required migration order and update missing-schema operator guidance without dropping the existing 0012 prerequisite.
- `src/lib/scans/process-scan.test.ts`: strengthen out-of-order deadline/resume assertions to include all recovered analysis/message counts; add live-versus-durable counter separation and rejected-checkpoint admission regressions. The strengthened case first FAILED with 1 persisted analysis count instead of 2, then passed after the fix.
- `src/lib/scans/scan-integration.test.ts`: keep the synthetic store's attribution mapping aligned with production; still not a real SQL test.
- `src/lib/scans/store-accounting.test.ts`: five tests for one-write attribution/readback, legacy/null cases, persistence failure and static migration safety. These are mocked/static tests, NOT proof of applied SQL or RLS.
- `src/lib/scans/continue-fallback.test.ts`: new synthetic continuation/fallback timestamp, self-fetch HTTP/network, missing credentials, checkpoint/read-write failure and deleted-checkpoint tests. Ordinary CI makes no live Gmail/provider/DB request.
- Verification checkpoint: 68/68 targeted scan/store/error/pool/continuation/integration tests PASS; typecheck PASS; lint PASS. One intermediate missing-schema message assertion failed because the new guidance omitted 0012; the guidance was corrected and the test passes. Extra fallback tests and broader final gates are recorded in the next checkpoint after completion.
- Supabase skill guidance informed the same-row upsert and explicit database verification gate; Postgres guidance informed the nullable FK/index. The Supabase CLI was not found, so the migration was authored with the required local patch workflow instead of installing tooling or applying schema to a live project. [Supabase upsert reference](https://supabase.com/docs/reference/javascript/upsert) checked; Markdown changelog fetch rejected its content type, HTML changelog available.
- Remaining TASK-003 gates: disposable SQL upgrade/fresh-schema proof, actual hard-kill/write-boundary recovery and ownership fencing (TEST-001/002/007, EDGE-001). Current behavior cannot reconstruct attribution for analyses saved before this migration; those stay unknown rather than fabricated. No commit, push, deployment or live database mutation in this resumed checkpoint.

The concurrent Cursor activity-log update is preserved. Cursor reports no new source changes and the same authenticated viewport/session blocker. Its statement that PR #91 merged is not independently verified in this checkpoint.

## Scope and preservation

The master plan has 72 tasks. Existing source changes in eight scan files predate this execution and are preserved; they are not claimed as newly authored here. The preceding audit added `docs/MASTER_PROJECT_PLAN.md` without changing application code. Current source branch: `avivnurs327/dia-5-inbox-workspace-ui`, initial HEAD `14d65e0404d5ee6ec24ce5b4146f94703103efa6`.

## Files added during execution

- `01-CHANGED-AND-ADDED.md`: file-level change and verified-task ledger.
- `02-COULD-NOT-SOLVE.md`: unresolved access, decisions and verification blockers.
- `03-REMAINING-TASKS.md`: original 72-task coverage, routing recommendations and detailed remaining steps.
- `cursorTasks.md`: user-requested parallel Cursor handoff with five scoped frontend tasks, owned-file boundaries, per-task status/evidence protocol and a reserved independent Codex-review column. Cursor implemented the assigned local scope; Codex independently accepted C01–C04 after review and requested/follow-up fixes. C05 remains externally pending.

## Decisions

Preserve the actual `src/` and `supabase/` architecture rather than relocate code under the generic `client/`/`server/` template. Preserve NVIDIA-if-configured, otherwise Gemini selection; no silent runtime failover or new data destination. Preserve manual lookback and scheduled incremental behavior. No new paid infrastructure, dependencies or production changes are authorized by a mere local fix. The requested circular progress reference is missing; do not invent its approved design.

## Verified task checkpoints

### BUG-001 — Complete, locally verified

Actual model: Codex, current session (no model override); actual work effort: Light, as planned.

- Changed `src/lib/scans/process-scan.test.ts`: the in-memory store persists all five omitted classification counters, matching production. A checkpoint snapshot is captured before the next fetch and asserted outside the Gmail callback, so observer failures cannot masquerade as Gmail failures. Original cursor, counters and failed-ID expectations are retained.
- Before the fix, targeted tests reproduced two failures (33 passed / 2 failed). After the fix, `npm test -- src/lib/scans/process-scan.test.ts src/lib/scans/store.test.ts` passed 35/35; `npm test` passed 459/459 across 92 files. No production code changed for this task.
- Diff reviewed against the existing helper and production mappings; surrounding pre-existing changes preserved. Next: BUG-003.

### BUG-003 — Complete, locally verified

Actual model: Codex, current session; actual work effort: Standard, as planned.

- Changed `src/lib/gmail/client.ts`: validate the structured OAuth error code and require renewed consent only for `invalid_grant`. Network, 429, 503 and `invalid_client` failures return a sanitized unavailable error without changing the stored Gmail consent. No raw provider error or token is returned.
- Changed `src/lib/scans/errors.ts`: shared safe `gmail_unavailable` user message.
- Added `src/lib/gmail/client.test.ts`: successful refresh and revoked/transient refresh cases for both per-user and per-connection status updates. The eight non-revocation cases failed before the fix and pass afterwards.
- Verification: targeted client/retry/OAuth/error tests PASS 27/27; `npm run typecheck` PASS. Source diff reviewed. Live Google refresh and live database status updates were not tested; these remain integration gates, not claims made by this task.
- Reference: [Google OAuth refresh errors](https://developers.google.com/identity/protocols/oauth2/web-server#offline). Supabase update documentation was checked; its changelog Markdown fetch was blocked by unsupported content type and the shell fallback by socket permissions. Existing query APIs were preserved.
- Next: BUG-004.

### BUG-004 — Complete, locally verified

Actual model: Codex, current session; actual work effort: Heavy, as planned.

- Changed `src/lib/scans/manual.ts`: preparation catches now include synchronous provider construction, resume, opening and marking the job. Cleanup is fenced to the admitted worker, uses a redacted error code, preserves existing resumable checkpoints, and reports cleanup failures with both errors.
- Changed `src/lib/scans/process-scan.ts`: if updating the connection fails after inserting a new scan, fail only that newly inserted RUNNING scan; report cleanup failures instead of silently leaving an orphan.
- Changed `src/lib/scans/jobs.ts`: attaching a scan to a just-created admission job cleans up that worker's lease on error/false; a successor's lease is not released.
- Added `src/lib/scans/manual-admission.test.ts`; extended `src/lib/scans/process-scan.test.ts` and `src/lib/scans/jobs.test.ts`. Regression tests reproduced seven preparation/orphan failures plus two job-admission leaks before their respective fixes. Successful preparation stays lazy until execute is called; resumed progress is preserved; the successor fencing test remains green.
- Verification: manual/admission/processor/job targeted tests PASS 57/57; typecheck PASS. Diff inspected. This is local fault injection, not proof of actual concurrent database isolation (TEST-002 remains).
- Next: BUG-007, slice-deadline propagation.

## Checks

### BUG-007 — Initial implementation checkpoint (superseded below)

- Added `src/lib/gmail/request-budget.ts`: bounded request/abort and budget-aware waits, with distinct slice-deadline versus request-timeout errors.
- Changed `src/lib/gmail/retry.ts`: request bounding and remaining-budget propagation through waits/quota; bounded 502/503/504 retries in addition to quota retries. Existing retries remain covered.
- Changed `src/lib/gmail/quota.ts`: quota admission/waits honor deadline and cancellation.
- Initial helper-boundary compatibility verification: `npm test -- src/lib/gmail/retry.test.ts src/lib/gmail/quota.test.ts` PASS 5/5. This is not sufficient to close BUG-007: fake-clock negative tests, SDK/OAuth option forwarding, same-invocation budget wiring, safe interruption checkpoints, and broader verification remain unfinished. These backend files remain exclusively owned by Codex.

Parallel-work decision: the owner authorized Cursor to help meanwhile. Cursor owns the specified scan UI/presentation files; Codex owns scan/Gmail backend and root reports. A thread follow-up checks Cursor status/evidence and relevant diffs every 15 minutes, staying quiet on unchanged state. Cursor claims are independently reviewed before acceptance. The initial handoff was later implemented and reviewed; see the final checkpoint below.

BUG-001 targeted tests: PASS 35/35. Full suite after BUG-001: PASS 459/459 (92 files). This was the initial checkpoint; the final checks are recorded below. Live database, Gmail consent, authenticated UI, deployment and merge remain unverified.

## Handoff checkpoint — 2026-09-29

Owner requested wrapping up the current work, committing/pushing it, opening a draft PR, then pausing the goal to continue in another chat. The full 72-task plan is **not finished**. No merge or explicit production deployment was performed. Branch: `codex/mailpilot-reliability-handoff-20260929`, created from the existing source HEAD to preserve work. `git fetch origin` passed; no dirty-tree pull, reset, discard, autostash or rebase was performed. The branch is not represented as synchronized with newer main commits.

### BUG-007 — Implemented and locally verified; termination/live gates remain

Actual model: Codex current session, no override. Planned/actual effort: Heavy; multi-file provider cancellation was necessary to prevent AI requests consuming checkpoint headroom. No provider failover, new data destination or dependency added.

- `src/lib/gmail/request-budget.ts` (new): distinguishes slice deadline and per-request timeout, aborts bounded requests, rejects waits that cannot fit, and removes timers/listeners when settled.
- `src/lib/gmail/request-budget.test.ts` (new): expired/hung/synchronous failure/success/cancellation/wait boundary tests.
- `src/lib/gmail/retry.ts`, `retry.test.ts`: bounded retries/quota waits including 429/502/503/504; no auth retry and no extra attempt when deadline cannot fit.
- `src/lib/gmail/quota.ts`, `quota.test.ts`: quota admission honors cancellation/deadline without consuming a rejected admission.
- `src/lib/gmail/messages.ts`: SDK deadline/signal and disabled implicit retry forwarded to message listing/fetch, thread fetch and history profile lookup.
- `src/lib/gmail/history-list.ts`: paginated History requests share the same remaining budget; incomplete discovery is not committed as complete.
- `src/lib/gmail/aliases.ts`: SendAs requests use the shared budget.
- `src/lib/gmail/labels.ts`: list/create requests have finite per-request bounds; scan label modifications share the invocation deadline. Managed-label behavior is preserved.
- `src/lib/gmail/oauth.ts`: token exchange, refresh and revocation have a bounded transporter; temporary signal/timeout options are restored.
- `src/lib/gmail/oauth-budget.test.ts` (new): synthetic transporter signal/timeout/restore tests, no network calls.
- `src/lib/gmail/client.ts`, `client.test.ts`: carry refresh deadlines through per-user/connection creation; a timed-out refresh does not falsely require renewed consent.
- `src/lib/scans/gmail-port.ts`, `types.ts`: a shared request budget is exposed to the processor and forwarded to every real Gmail scan operation.
- `src/lib/scans/gmail-port.test.ts` (new): six never-resolving SDK-method cases prove timeout/signal/retry options and timer cleanup.
- `src/lib/scans/manual.ts`, `continue.ts`, `dispatcher.ts`: start the deadline before preparation/refresh and reuse it during execution rather than resetting it for the scan.
- `src/lib/ai/analyze-thread.ts`: optional caller AbortSignal is passed through validation wrappers to the provider.
- `src/lib/ai/client.ts`, `nvidia.ts`: caller cancellation aborts generation and retry backoff without another attempt; timers/listeners are cleaned up.
- `src/lib/ai/provider-cancellation.test.ts` (new): eight synthetic Gemini/NVIDIA cancellation/backoff/pre-aborted regressions, no paid calls.
- `src/lib/scans/process-scan.ts`: provider work is bounded by remaining slice time; interrupted discovery or thread work returns CONTINUED, leaves the scan RUNNING and restores the last durable completed-prefix counters/cursor/failures. Worker/progress writes drain first; no false SUCCESS/history advance.
- `src/lib/scans/process-scan.test.ts`: hung discovery, hung fetch with committed-prefix resume, hung provider, and later-worker completion behind a hung earlier thread are covered. Cached results/current label state avoid replaying completed labels in the local model.
- `src/lib/scans/errors.ts`: formatting finalized for the previously added sanitized unavailable message.

Local checkpoint counters do **not** prove crash-safe per-thread accounting for all mid-write boundaries. In particular, a completed later worker outside the saved prefix can be cached on resume while its first-attempt AI-call metric was not durably counted. TASK-003 / EDGE-001 / TEST-007 remain open. Real process-kill, disposable database concurrency/RLS and live OAuth/Gmail integration have not been verified. BUG-007 is not claimed fully closed against its TEST-007 termination gate.

Verification: nine-file targeted run PASS 88/88; follow-up OAuth/processor/continue/dispatcher/integration run PASS 65/65. Initial TS2493 test-mock tuple errors and TS2322 nullable-signal fixture error were fixed; final typecheck passes. One existing resume test initially failed because it moved the clock to the deadline before admitting AI; its clock now ends after the first thread's label commit, preserving the completed-prefix assertion while the new deadline test forbids late provider admission.

### Cursor lane — independently reviewed, local scope only

- `src/components/scans/initial-scan-card.tsx`: three unavailable/malformed responses stop observation; matching snapshots reset the count; unrelated scans cannot finish the watched scan. Serial bounded polling, single resume, generation guards and unmount cleanup; failed cancellation is retryable, concurrent cancellation is guarded; 401 uses sign-in messaging. Truthful partial copy and accessible lookback name.
- `src/components/scans/initial-scan-card.test.tsx` (new): fake timers/deferred requests cover reset limit, hung/late poll, start/cancel/resume lifecycle and Strict Mode.
- `src/components/scans/scan-progress-bar.test.tsx` (new): terminal empty results, ARIA/reduced-motion and partial copy. Production `scan-progress-bar.tsx` was not modified.
- `src/lib/scans/progress.ts`, `progress.test.ts`: only presentation changed; empty SUCCESS is determinate 100%, empty PARTIAL/FAILED terminal, no unsupported queued-retry claim. Cursor/schema APIs retained.
- `cursorTasks.md`: statuses, ownership, append-only evidence, initial review requests and acceptance after fixes. Independent targeted verification PASS 50/50. C01–C04 accepted locally; C05 externally pending for real viewport/authenticated checks.
- The 15-minute review heartbeat `review-cursor-mailpilot-tasks` is PAUSED for the requested chat handoff, not silently active.

### Preserved pre-existing source changes included in the handoff

These eight files were already dirty before this execution. Their related scan reliability changes are retained, not falsely attributed as wholly new work:

- `src/lib/scans/continue.test.ts`: existing continuation fault/scheduling test changes.
- `src/lib/scans/continue.ts`: existing bounded self-fetch and checked fallback scheduling/preparation scope.
- `src/lib/scans/dispatch-budget.ts`: existing 210-second work budget.
- `src/lib/scans/pool.ts`, `pool.test.ts`: existing pool failure stops admission and drains workers.
- `src/lib/scans/process-scan.ts`, `process-scan.test.ts`: existing batch/prefix checkpoint and fenced processing changes, plus fixes described above.
- `src/lib/scans/scan-integration.test.ts`: existing integration mock option/lease compatibility.

Other execution files `src/lib/scans/jobs.ts`, `jobs.test.ts`, `manual-admission.test.ts` are accounted for under BUG-004 above. `docs/MASTER_PROJECT_PLAN.md` is the prior audit's original 72-task plan and is included for portable context. All three root reports are updated for handoff. A concurrent actor committed the entire source snapshot as `c00dd928ba2a738c8b20fe76c9f1b698dceb4f9d` during wrap-up, including `docs/HUMAN_TASKS.md`. That commit is preserved without rewriting history; the human-task document subsequently received a format-only fix so the existing content remains intact and CI formatting can pass.

### Final practical checks

- `npm test`: PASS 537/537 across 100 files.
- `npm run test:integration`: PASS 17/17 across three files (local simulations, not live database proof).
- `npm run eval:scorecard`: PASS 2/2.
- `npm run typecheck`: PASS after the documented test-fixture fixes.
- `npm run lint`: PASS, zero warnings after Cursor's cleanup fix.
- `npm run build`: PASS, production compilation/typecheck/page generation completed.
- Cursor-owned-file tests/check: PASS 50/50 and explicit Prettier check PASS.
- Whole working-tree `npm run format:check`: initially failed on in-progress owned files and the human-task document. Owned files were formatted; after the concurrent commit included the human-task document, an explicit format-only fix was applied without removing its content changes. Final recheck is recorded below.
- `git diff --check`: PASS.

Next chat: read `cursorTasks.md`, this report, `02-COULD-NOT-SOLVE.md`, `03-REMAINING-TASKS.md`, repository instructions and product decisions. Verify the PR/head and current worktree first, then resume TASK-003 accounting/crash gates and the remaining dependency-ordered work. Do not restart completed local fixes or mark live/external tasks done.

Formatting provenance: the previous check failed solely on `docs/HUMAN_TASKS.md`; it was excluded from Codex staging, but a concurrent actor had already included it in commit `c00dd92`. A follow-up formats only that included file and preserves its content. Do not claim the initial failing check passed; the final recheck is separate.

Final `npm run format:check`: PASS after adding the missing trailing newline to the already-committed human-task document. No substantive content was changed by this formatting fix. That document's externally checked/live-success claims were authored by another actor and were not reverified here; the current audited scan failures and real release gates in the master plan/root reports still apply. Manual Scan now continues honoring its selected lookback, rather than being guaranteed incremental.
