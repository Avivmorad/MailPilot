# Cursor tasks — parallel scan UI reliability work

Updated: 2026-09-29. Repository: `C:\Users\Daniel\Desktop\Aviv Projects\MailPilot\mailpilot`.

This is an execution handoff, not a request for another plan. Implement the tasks below, one at a time, while Codex works independently on Gmail requests, scan deadlines, admission, recovery and security. The owner explicitly authorized this parallel work. Read this file and relevant repository instructions before editing.

## Source of truth and safety

- Read `AGENTS.md`, `docs/PRODUCT_DECISIONS.md`, and the relevant cards in `docs/MASTER_PROJECT_PLAN.md`. Product decisions override the old spec. Preserve the actual `src/` and `supabase/` layout.
- Keep Google identity login separate from explicit Gmail connection. Summary = useful FYI; Ignored = noise/OTPs; Open = real next steps. No new bucket, provider, consent flow, paid service, dependency or circular progress redesign.
- Preserve all existing dirty changes. Never reset, checkout/discard files, autostash, pull over dirty work, stage everything, commit another agent's work, deploy, publish, merge, change a live database, or alter account settings.
- Do not treat green narrow tests as proof of live Gmail, authenticated browser or database behavior. No fabricated completion, screenshots or results.
- A command/action that hangs for five minutes must be stopped and diagnosed. Try at most two reasonable alternatives, record the blocker, and continue independent tasks.

## File ownership — essential for parallel work

Cursor may edit only:

- `src/components/scans/initial-scan-card.tsx`
- `src/components/scans/initial-scan-card.test.tsx` (create it if needed)
- `src/components/scans/scan-progress-bar.tsx`
- `src/components/scans/scan-progress-bar.test.tsx` (create it if needed)
- `src/lib/scans/progress.ts`: only `scanProgressView` presentation behavior; keep exported signatures, schemas, `snapshotProgress`, `scanProgressPercent`, and `advanceContiguousCursor` unchanged.
- `src/lib/scans/progress.test.ts`: add/update relevant presentation regressions; retain cursor/schema coverage.
- This `cursorTasks.md`: update Cursor status, evidence, blockers and the append-only activity log. Do not alter scope or the Codex-review column.

Codex owns all other files, especially `src/lib/gmail/**`, scan processor/store/jobs/manual/continue/dispatcher/types/errors/budgets, API routes, migrations, shared test/config files, dependencies, master plan and the three root reports. Do not change them even if a check fails there. If your task needs another file, mark that portion BLOCKED with the proposed file and reason. Do not silently extend ownership.

Do not run whole-repository formatter writes. Format only your owned edited files. Both agents use the same checkout; read a file again immediately before patching it. Keep work in this checkout and do not create branches/worktrees or Git commits for this handoff.

## Status protocol

Update the table before starting a task and immediately after each implementation/check. Only one Cursor task may be IN_PROGRESS.

Statuses: TODO, IN_PROGRESS, IMPLEMENTED, VERIFIED_LOCALLY, BLOCKED, CHANGES_REQUESTED. VERIFIED_LOCALLY requires the listed regression tests and local checks to pass; it does not mean Codex accepted the task or the original master-plan item is fully complete. Codex alone updates its review column: PENDING, REVIEWING, ACCEPTED_LOCAL, CHANGES_REQUESTED, EXTERNAL_GATE_PENDING.

For every update, append UTC time, task ID, actual files changed, behavior fixed, commands with pass/fail counts, failures classified as your change/pre-existing/other-agent/environment, blockers and next task. Report incomplete verification explicitly. Do not modify or erase earlier evidence. Never use passwords, real email bodies, tokens or API keys in fixtures or this log.

| Cursor ID | Master-plan mapping                          | Priority | Depends on    | Cursor status    | Codex review          |
| --------- | -------------------------------------------- | -------- | ------------- | ---------------- | --------------------- |
| C01       | BUG-002                                      | P1       | None          | VERIFIED_LOCALLY | ACCEPTED_LOCAL        |
| C02       | EDGE-010; local part of EDGE-011 / TEST-006  | P1       | C01           | VERIFIED_LOCALLY | CHANGES_REQUESTED     |
| C03       | BUG-006; local part of TEST-006              | P2       | None          | VERIFIED_LOCALLY | ACCEPTED_LOCAL        |
| C04       | UI-only part of BUG-005                      | P1       | C01, C03      | VERIFIED_LOCALLY | ACCEPTED_LOCAL        |
| C05       | Scan-component subset of TASK-013 / TEST-006 | P2       | C02, C03, C04 | VERIFIED_LOCALLY | EXTERNAL_GATE_PENDING |

Execution order: C01 → C02 → C03 → C04 → C05. Keep tightly coupled UI work in one session. Use your currently configured coding model; no model override is required. Planned effort: C01 Light, C02 Heavy, C03 Light, C04 Light, C05 Standard. Escalate ownership/dependency conflicts to this file instead of rewriting shared code.

## C01 — Stop polling after repeated missing or invalid scan responses

Current defect: `InitialScanCard` resets `nullPolls.current` before checking `result.scan`. Repeated HTTP 200 `{ scan: null }` therefore never reaches the three-response limit and leaves Scanning active indefinitely. A malformed payload is also currently treated as successful-null.

Steps:

1. Add a failing component regression using existing Vitest / Testing Library and mocked `next/navigation` / fetch.
2. Count consecutive unavailable, invalid or null responses consistently. Reset the counter only after a valid snapshot for the watched scan, not merely a successful HTTP status.
3. After three such responses, show a clear retryable error, exit busy/watch state, re-enable Scan now, and stop automatic polling. Keep valid RUNNING and terminal success/failure behavior.
4. Do not let an unrelated old scan reset the failure count or mark the watched scan complete.

Acceptance: three successful-null responses stop polling; malformed payloads do not spin forever; a valid matching snapshot resets the count; unrelated snapshots do not finish the current scan; success navigates once and failure/cancellation preserves its message.

Verification: component regressions for these cases, including number of fetches and no further automatic polls after the error. No real Gmail calls.

## C02 — Make polling, resume and user requests bounded and lifecycle-safe

Current risk: the 800 ms interval can overlap requests; fetches have no deadline; resume completion can mutate state after unmount; stale responses can overwrite a later scan or a successful cancellation.

Steps:

1. Add deferred-fetch and fake-clock tests before changes.
2. Permit at most one polling request at a time; schedule the next tick after the previous one settles. Preserve prompt progress updates without tight retries.
3. Use AbortController with a finite request deadline and cleanup for poll/start/resume/cancel. Clear timers/listeners when settled or unmounted. Do not silently mask timeout/network/schema failures.
4. Ignore late responses after unmount, effect replacement, cancellation or a new scan generation. Resume at most once concurrently; clear the guard reliably after success/failure.
5. Recover from 401 with a clear sign-in message and stopped monitoring, without treating it as Gmail re-consent. Validate failure payloads rather than casting arbitrary external data as trustworthy.
6. Keep server state authoritative: a browser timeout means progress could not be observed, not that the background scan was cancelled or failed. Do not trigger automatic replacement scans repeatedly.

Acceptance: no overlapping polls while a fetch is unresolved; hung fetch stops within the chosen deadline; no late state/navigation updates after unmount/cancel/new generation; bounded resume calls; controls recover from failure; 401 is explicit. Strict Mode setup/cleanup must not leak timers or listeners.

Verification: fake timers/deferred promises for slow polls, deadline, malformed response, network rejection, 401, resume rejection, cancellation races, unmount/remount and obsolete scan IDs. Keep a real authenticated-session journey marked unverified; that requires separate owner access.

## C03 — Give empty terminal scans a terminal progress state

Current defect: `scanProgressView` checks zero discovered threads before SUCCESS/PARTIAL, so an empty successful scan still displays Finding conversations with an indeterminate animation.

Steps: add regressions for empty SUCCESS, PARTIAL and FAILED/cancelled; order terminal handling correctly; use truthful empty-result text; preserve the RUNNING discovery state, existing non-empty status behavior, and cursor/schema APIs.

Acceptance: an empty SUCCESS is determinate and complete, with a no-conversations result; zero-thread PARTIAL and FAILED are determinate and do not claim successful processing; RUNNING with unknown totals stays indeterminate. The progressbar exposes consistent aria-valuenow/aria-valuetext and reduced-motion behavior.

Verification: `progress.test.ts` plus rendered progressbar assertions for zero totals and terminal statuses. Do not fabricate a zero-total PARTIAL success or change stored counters.

## C04 — Remove unsupported retry guarantees from scan UI copy

Current defect: the footer always says Retries queued for PARTIAL, and the progress helper repeats this claim. PARTIAL records failed threads but does not by itself prove a queued/scheduled retry. Backend retry-policy work is owned by Codex and remains unfinished.

Steps: replace these unconditional claims with truthful copy that some conversations could not be processed / need another scan. Keep partial distinct from full success. Avoid promises about retry timing or browser-independent recovery; do not alter backend retry policy, errors.ts, schema or scheduling.

Acceptance: neither owned UI surface promises a queue or SLA from PARTIAL alone; tested progress/error copy is consistent and useful. This completes only the UI-copy subtask, not master BUG-005's backend/dependency acceptance.

Verification: component and helper tests for PARTIAL, error messaging and absence of Retries queued. Preserve successful/failed/cancelled labels and canonical triage meaning.

## C05 — Verify accessibility and layout of the owned scan components

Scope is the scan card/progressbar only, not a site-wide redesign or authenticated journey.

Steps: cover accessible names for lookback/select/buttons, disabled/busy/cancel states, polite progress/status updates, alert messaging, keyboard operation and reduced motion. Inspect narrow/mobile and 200% zoom layout if a safe existing browser/dev session is available. No horizontal overflow caused by these components. Do not install browser tooling or new dependencies.

Acceptance: component accessibility assertions pass; no inaccessible control or unbounded animation introduced; real viewport checks are separately recorded if actually run. If authenticated/browser access is absent, mark that verification BLOCKED and still complete all safe component checks. The missing selected circular design is explicitly out of scope.

Verification: Testing Library tests; local typecheck/lint; relevant browser checks only with available authorized access. No claim that jsdom proves actual visual layout or the complete TASK-013 / TEST-006 journey.

## Commands and handoff

From the repository root, run only existing scripts. Use the installed runtime; no installs are needed.

```text
npm test -- src/components/scans/initial-scan-card.test.tsx src/components/scans/scan-progress-bar.test.tsx src/lib/scans/progress.test.ts
npm run typecheck
npm run lint
```

Do not pass a not-yet-created test file as proof it was tested. Format edited owned files using the installed Prettier binary with explicit file arguments. Run broader `npm test`, `npm run format:check`, and `npm run build` when your lane is stable and report concurrent backend failures without changing those files. Save exact final evidence and diff summary in the activity log. Codex will inspect the diff, independently rerun relevant checks, review interactions with ongoing backend changes, and accept or request fixes here. Do not mark the whole project done.

## Cursor activity log

No Cursor implementation has started or been verified yet.

2026-09-29T11:54Z C01–C05 VERIFIED_LOCALLY. Files: `src/components/scans/initial-scan-card.tsx`, `src/components/scans/initial-scan-card.test.tsx` (new), `src/components/scans/scan-progress-bar.test.tsx` (new), `src/lib/scans/progress.ts` (`scanProgressView` only), `src/lib/scans/progress.test.ts`, `cursorTasks.md`. `scan-progress-bar.tsx` was not changed; existing aria and reduced-motion classes already matched C05.

Behavior: three consecutive null or invalid progress responses stop polling and re-enable Scan now. A matching snapshot clears that count; an unrelated scan does not finish the watched scan or clear it. Polls do not overlap; a hung GET aborts after 10s and is treated as an observation failure, not a cancelled scan. One automatic resume per scan id. 401 says to sign in and does not offer Gmail reconnect. Empty SUCCESS is determinate ("No conversations in this window."). PARTIAL copy no longer says retries are queued. Footer says some conversations need another scan.

Commands: `npm test -- src/components/scans/initial-scan-card.test.tsx src/components/scans/scan-progress-bar.test.tsx src/lib/scans/progress.test.ts` — 3 files, 36 passed, 0 failed. `npm run typecheck` passed. `npm run lint` passed. Prettier write on the owned files above; two test files were reformatted, then the same 36 tests passed again.

Not run: authenticated browser journey, narrow viewport, and 200% zoom. Those remain BLOCKED for this lane (no separate authorized visual session in this pass). jsdom does not prove visual layout. No commit, deploy, or live database change.

2026-09-29T11:57Z Wider checks. `npm test` — 97 files, 514 passed, 0 failed. `npm run format:check` failed on 21 files. Owned scan files and this file pass Prettier. The other failures are outside this lane (`docs/HUMAN_TASKS.md` and Codex-owned `src/lib/gmail/**` plus `src/lib/scans/**`); not reformatted. `npm run build` compiled, then failed typecheck in `src/lib/scans/gmail-port.test.ts` and `src/lib/scans/process-scan.test.ts` (`TS2493` tuple index). Classified other-agent. `npm run typecheck` earlier in this pass did not include those test failures. Cursor status for C01–C05 stays VERIFIED_LOCALLY. Next: Codex review.

2026-09-29T12:15Z C02 CHANGES_REQUESTED addressed in owned files only. Files: `src/components/scans/initial-scan-card.tsx`, `src/components/scans/initial-scan-card.test.tsx`, `cursorTasks.md`.

Behavior fixes:

1. Cancel is serialized (`cancelInFlightRef`). Generation still bumps to drop late polls, but a failed/timeout cancel exits busy with a retryable alert and re-enables Scan now (no stuck busy/no-poll). A second cancel click while one is in flight is ignored so a later failure cannot overwrite a confirmed cancel.
2. Start/cancel AbortControllers are tracked in `actionControllersRef` and aborted on unmount even when `watchId` is still null (pending start). Late start/cancel responses after unmount are ignored via generation.
3. `deadlineSignal` returns `{ signal, dispose }`. Dispose runs in `finally` after every poll/resume/start/cancel request. Already-aborted parents install no timer/listener. Successful polls leave only the inter-poll wait timer (asserted).
4. Malformed/null resume POST stops with the observation error; resume 401 uses the sign-in message (no Gmail reconnect). Single resume per scan id; late resume after unmount/cancel ignored.

Tests added/extended: third miss after reset, residual timers, Strict Mode remount late success, cancel HTTP/timeout/overlap/unmount, start schema + start unmount, stale resume once/malformed/401/rejected/late-after-unmount/late-after-cancel.

Commands: `npm test -- src/components/scans/initial-scan-card.test.tsx src/components/scans/scan-progress-bar.test.tsx src/lib/scans/progress.test.ts` — 3 files, 50 passed, 0 failed. `npm run lint` passed (0 warnings after controllers-ref cleanup capture). Prettier write on owned `initial-scan-card.tsx` / test / this file. `npm run typecheck` failed in Codex-owned `src/lib/gmail/oauth-budget.test.ts` (`TS2322` AbortSignal null); not edited (other-agent). Authenticated browser / viewport checks still BLOCKED for this lane.

C02 Cursor status → VERIFIED_LOCALLY. Codex review column left CHANGES_REQUESTED pending re-review.

## Codex review log

2026-09-29: Handoff created from current source evidence. All reviews PENDING. Backend work remains with Codex; frontend work is reserved for Cursor. No code in the Cursor lane was edited by Codex for this handoff.

2026-09-29T12:05Z Independent Codex review: C01, C03 and C04 accepted locally after source/diff inspection and rerunning all three Cursor test files (36/36 passed as part of a seven-file run). Progress/schema/cursor APIs outside `scanProgressView` were preserved. C04 closes UI copy only, not the backend retry-policy task. C05 component assertions pass, but authenticated mobile/200% zoom and whole-product accessibility remain unverified; C02 must also be fixed before end-to-end acceptance. No deployment, real Gmail or database proof is implied.

C02 CHANGES_REQUESTED — fix only your owned files, add focused regressions, then update your status/evidence and request another review:

1. `cancelScan` increments `generationRef` immediately, invalidating the polling loop. On a failed/network cancel, busy/watchId remain unchanged, so the effect does not restart and the controls remain stuck with no polling. On overlapping cancel clicks, an older successful cancellation can also be hidden by a newer failed one. Serialize cancellation and either resume observation or leave a clearly retryable, truthful non-busy state when cancellation cannot be confirmed. Test HTTP rejection, timeout/network failure and late success versus a repeated click.
2. `requestJson` has a private controller without component-level unmount cleanup. When start is pending with `watchId === null`, the polling effect never installs cleanup; unmount does not change the generation or abort this request. Late responses can update unmounted state. Track active start/cancel controllers and dispose them on unmount independently of whether polling started. Test pending start/cancel unmount and replacement generation.
3. `deadlineSignal` clears its timer/listener only when aborted, not when poll/resume succeeds or rejects. Each settled call keeps a timer/parent listener for up to 10 seconds; Strict Mode/fast repeated polls accumulate resources. Provide explicit disposal in `finally` for every request and test zero residual timers/listeners when settled/unmounted. Handle an already-aborted parent before installing resources.
4. Automatic resume currently treats HTTP 200 malformed/null payload as a silent no-op. The scan is already added to `resumedScanIds`, so it will never automatically retry, while each valid stale RUNNING poll continues clearing observation misses. Stop with an explicit retryable observation error for malformed resume; use the sign-in message for a 401 resume rather than generic failure. Add stale-scan tests for single resume, rejected/malformed/401 resume and late resume after unmount/cancel.

The existing reset-count test stops after only two misses following a valid snapshot; extend it through the third miss and prove polling stops. Add the requested Strict Mode, successful-cancel race and start-schema tests. These gaps were found by source review; the existing 36 passing tests do not cover them. Main-owned test TS2493 failures noted by Cursor were corrected and typecheck subsequently passed; do not edit those backend files.
