# Changes and verification

Execution started 2026-09-29. This is a live checkpoint, not a completion claim.

## Scope and preservation

The master plan has 72 tasks. Existing source changes in eight scan files predate this execution and are preserved; they are not claimed as newly authored here. The preceding audit added `docs/MASTER_PROJECT_PLAN.md` without changing application code. Current source branch: `avivnurs327/dia-5-inbox-workspace-ui`, initial HEAD `14d65e0404d5ee6ec24ce5b4146f94703103efa6`.

## Files added during execution

- `01-CHANGED-AND-ADDED.md`: file-level change and verified-task ledger.
- `02-COULD-NOT-SOLVE.md`: unresolved access, decisions and verification blockers.
- `03-REMAINING-TASKS.md`: original 72-task coverage, routing recommendations and detailed remaining steps.
- `cursorTasks.md`: user-requested parallel Cursor handoff with five scoped frontend tasks, owned-file boundaries, per-task status/evidence protocol and a reserved independent Codex-review column. The handoff is formatted and its source references were verified; Cursor implementation has not yet been observed.

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

### BUG-007 — In progress, not complete

- Added `src/lib/gmail/request-budget.ts`: bounded request/abort and budget-aware waits, with distinct slice-deadline versus request-timeout errors.
- Changed `src/lib/gmail/retry.ts`: request bounding and remaining-budget propagation through waits/quota; bounded 502/503/504 retries in addition to quota retries. Existing retries remain covered.
- Changed `src/lib/gmail/quota.ts`: quota admission/waits honor deadline and cancellation.
- Initial helper-boundary compatibility verification: `npm test -- src/lib/gmail/retry.test.ts src/lib/gmail/quota.test.ts` PASS 5/5. This is not sufficient to close BUG-007: fake-clock negative tests, SDK/OAuth option forwarding, same-invocation budget wiring, safe interruption checkpoints, and broader verification remain unfinished. These backend files remain exclusively owned by Codex.

Parallel-work decision: the owner authorized Cursor to help meanwhile. Cursor owns the specified scan UI/presentation files; Codex owns scan/Gmail backend and root reports. A thread follow-up checks Cursor status/evidence and relevant diffs every 15 minutes, staying quiet on unchanged state. Cursor claims are independently reviewed before acceptance. This does not imply Cursor has started.

BUG-001 targeted tests: PASS 35/35. Full suite after BUG-001: PASS 459/459 (92 files). Other gates have not yet been rerun in execution. Live database, Gmail consent, authenticated UI, deployment and merge remain unverified.
