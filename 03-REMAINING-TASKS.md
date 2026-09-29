# Remaining master-plan tasks

Execution handoff, 2026-09-29. All 72 original IDs remain tracked. BUG-001/002/003/004/006 are complete locally; BUG-007 is implemented and locally checked but its real termination gate remains open. The owner requested a draft-PR checkpoint and paused-goal handoff to another chat. The full plan is not finished.

Resumed 2026-09-29 by explicit owner request to continue tasks and updates. TASK-003 local counter-accounting work is implemented with targeted checks; real SQL/migration/hard-kill gates remain open. No deployment, live database change or full-plan completion is claimed.

PR #92 merged the local TASK-003 implementation into `main`; this does not close its database/hard-kill gates. SEC-008's parser bounds are now implemented on a separate branch, but permanent oversized-message retry behavior remains unresolved under TASK-005 and no live Gmail path was verified.

## Execution assumptions

The owner subsequently authorized a separate Cursor lane. `cursorTasks.md` reserves BUG-002, EDGE-010, BUG-006 and the UI-copy portion of BUG-005, plus owned-component TEST-006/TASK-013 verification for Cursor. Codex continues backend work and independently reviews that lane. The original full-task acceptance gates remain; component-only work does not close authenticated/live journey requirements.

One implementation task at a time. Relevant repository instructions and owner product decisions remain authoritative. Preserve existing dirty work. Use existing dependencies and script names. The conservative defaults are existing architecture, current provider selection, current manual/scheduled scan scope, and no paid infrastructure. External account decisions, destructive tests and deployment approvals remain explicit prerequisites. Locally implementable subwork may proceed while its live acceptance gate remains pending.

Critical path: BUG-001 → BUG-004 / BUG-007 → TASK-003 → TASK-004 / TASK-005 → real database and API gates → authenticated UX and live Gmail → release smoke → approved PR merge. BUG-003, BUG-002 and BUG-006 are independently ready. Slash-separated branches here are dependency alternatives, not parallel implementation authorization.

## Task table

The task cards below preserve each original acceptance criterion, affected files, steps, tests, dependencies and priority. Do not mark complete from edits alone.

| ID       | Task                                                            | Depends on                                        | Status                                           | Acceptance / verification                                                  |
| -------- | --------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------- |
| TASK-001 | Diagnose the two all-failure live scans                         | none                                              | Not started                                      | Original acceptance and verification below                                 |
| TASK-002 | Complete and reconcile historical context inventory             | none                                              | Not started                                      | Original acceptance and verification below                                 |
| BUG-001  | Repair the checkpoint regression test harness                   | none                                              | Complete locally                                 | 35/35 targeted; 459/459 full suite                                         |
| BUG-003  | Do not disconnect Gmail on transient refresh failure            | none                                              | Complete locally                                 | 27/27 targeted; typecheck PASS                                             |
| BUG-004  | Release admitted leases when scan preparation fails             | BUG-001                                           | Complete locally                                 | 57/57 targeted; typecheck PASS                                             |
| BUG-007  | Bound Gmail calls and retries by the slice deadline             | BUG-001                                           | Implemented locally; gate pending                | 537 tests/build/typecheck pass; TEST-007 real termination remains          |
| BUG-008  | Distinguish failed analysis from normal FYI                     | TASK-001                                          | Not started                                      | Original acceptance and verification below                                 |
| TASK-003 | Finish verification of the existing checkpoint/pool patch       | BUG-001, BUG-007                                  | Local accounting fixed; database gates pending   | 68 targeted tests, typecheck and lint pass; migration/TEST-002/007 pending |
| TASK-004 | Make continuation/retry independent of an open browser          | BUG-004, BUG-007, DEC-002                         | Not started                                      | Original acceptance and verification below                                 |
| TASK-005 | Record redacted per-thread failure reasons and retry policy     | TASK-001, DEC-002                                 | Not started                                      | Original acceptance and verification below                                 |
| EDGE-001 | Crash between writes and durable checkpoint                     | BUG-001, TASK-003                                 | Not started                                      | Original acceptance and verification below                                 |
| EDGE-002 | Simultaneous tabs, cron, manual scan and continuation           | BUG-004                                           | Not started                                      | Original acceptance and verification below                                 |
| EDGE-003 | Cancellation/deletion while a worker is in flight               | TASK-003, TEST-001                                | Not started                                      | Original acceptance and verification below                                 |
| EDGE-004 | Discovery pagination interrupted before discovery_complete      | BUG-007                                           | Not started                                      | Original acceptance and verification below                                 |
| EDGE-005 | New inbound arrives during scan/history recovery                | TASK-003                                          | Not started                                      | Original acceptance and verification below                                 |
| EDGE-006 | Stale timestamps and misleading job/scan status combinations    | TASK-004/005                                      | Not started                                      | Original acceptance and verification below                                 |
| EDGE-007 | Deleted/stale managed labels and legacy rename                  | TEST-005                                          | Not started                                      | Original acceptance and verification below                                 |
| EDGE-008 | MIME, aliases, attachments, multilingual and long threads       | TEST-004/005                                      | Not started                                      | Original acceptance and verification below                                 |
| EDGE-009 | Deletions, Trash and label-only history events                  | DEC-006                                           | Not started                                      | Original acceptance and verification below                                 |
| TASK-006 | Establish a representative classification quality gate          | TASK-001                                          | Not started                                      | Original acceptance and verification below                                 |
| TASK-007 | Add optional bounded runtime failover only after decision       | TASK-001, DEC-003, TEST-004                       | Not started                                      | Original acceptance and verification below                                 |
| TASK-008 | Benchmark and bound scan efficiency                             | BUG-007, TASK-003/005                             | Not started                                      | Original acceptance and verification below                                 |
| TASK-009 | Preserve manual overrides across re-analysis                    | TEST-004                                          | Not started                                      | Original acceptance and verification below                                 |
| TASK-010 | Make feedback/canonical state changes consistent                | TEST-001/003                                      | Not started                                      | Original acceptance and verification below                                 |
| TASK-011 | Prevent lost updates from simultaneous user/scan actions        | TEST-002/003, TASK-009                            | Not started                                      | Original acceptance and verification below                                 |
| BUG-002  | Stop repeated successful-null scan polling                      | none                                              | Complete locally                                 | Cursor C01 independently accepted; 50 owned tests pass                     |
| BUG-005  | Remove false “Retries queued” guarantees                        | TASK-005, EDGE-006                                | UI copy accepted; backend not started            | Cursor C04 complete only; TASK-005 retry policy remains                    |
| BUG-006  | Give empty terminal scans an actual terminal view               | none                                              | Complete locally                                 | Cursor C03 independently accepted; empty terminal view covered             |
| BUG-009  | Do not present failed DB reads as “no changes”                  | TEST-003                                          | Not started                                      | Original acceptance and verification below                                 |
| EDGE-010 | Overlapping polls, refresh, navigation and hanging fetch        | BUG-002                                           | Local fixes accepted; external pending           | Cursor C02 review fixes and 50 tests accepted; authenticated gates remain  |
| EDGE-011 | Expired sessions during long flows                              | TEST-003/006                                      | Not started                                      | Original acceptance and verification below                                 |
| TASK-012 | Verify the complete authenticated journey                       | TASK-001, TEST-003, disposable account access     | Not started                                      | Original acceptance and verification below                                 |
| TASK-013 | Responsive, keyboard, RTL and accessibility acceptance          | TASK-012                                          | Scan-component subset verified; rest not started | Cursor C05 local assertions; real viewport/full-product checks pending     |
| TASK-014 | Apply the requested scan/workspace UX polish narrowly           | DEC-004, BUG-002/005/006, TASK-012/013            | Not started                                      | Original acceptance and verification below                                 |
| SEC-001  | Prove two-user database isolation                               | none                                              | Not started                                      | Original acceptance and verification below                                 |
| SEC-002  | Verify deletion, retention and token revocation end to end      | EDGE-003, TEST-001                                | Not started                                      | Original acceptance and verification below                                 |
| SEC-003  | Keep secrets and personal data out of browser/logs              | none                                              | Not started                                      | Original acceptance and verification below                                 |
| SEC-004  | Address leaked-password protection advisor warning              | DEC-005                                           | Not started                                      | Original acceptance and verification below                                 |
| SEC-005  | Exercise malicious email/output and unsafe links                | TEST-004                                          | Not started                                      | Original acceptance and verification below                                 |
| SEC-006  | Verify mutation authorization, abuse bounds and CSRF posture    | TEST-003                                          | Not started                                      | Original acceptance and verification below                                 |
| SEC-007  | Finish source-security coverage and operational threat review   | SEC-001/003/006                                   | Not started                                      | Original acceptance and verification below                                 |
| SEC-008  | Bound MIME ingestion and make HTML conversion linear            | none                                              | Implemented locally; recovery gate pending       | 37 targeted, 588 full tests/build; oversized retry policy pending          |
| SEC-009  | Keep abuse budgets and in-flight bounds across cancellation     | BUG-007, explicit retry UX decision               | Not started                                      | Original acceptance and verification below                                 |
| SEC-010  | Enforce thread ownership for direct feedback INSERT             | TEST-001, OPS-005 before deployment               | Not started                                      | Original acceptance and verification below                                 |
| TEST-001 | Add real database/RLS and migration tests                       | approved disposable database access               | Not started                                      | Original acceptance and verification below                                 |
| TEST-002 | Add actual DB lease/checkpoint concurrency tests                | TEST-001, BUG-001/004/007                         | Not started                                      | Original acceptance and verification below                                 |
| TEST-003 | Add API contract and negative-authorization matrix              | TEST-001                                          | Not started                                      | Original acceptance and verification below                                 |
| TEST-004 | Add provider contracts and real opt-in evaluation               | TASK-001, DEC-003                                 | Not started                                      | Original acceptance and verification below                                 |
| TEST-005 | Add disposable Gmail integration verification                   | explicit test Gmail access/consent                | Not started                                      | Original acceptance and verification below                                 |
| TEST-006 | Add repeatable authenticated browser/component regressions      | BUG-002, TASK-012                                 | Component subset verified; external pending      | 50 owned tests pass; authenticated browser journey not verified            |
| TEST-007 | Add interruption and recovery fault-injection matrix            | BUG-007, TASK-003/004, TEST-002                   | Not started                                      | Original acceptance and verification below                                 |
| TEST-008 | Add privacy/security regression suite                           | TEST-001/003, SEC-002/003/005/006                 | Not started                                      | Original acceptance and verification below                                 |
| TEST-009 | Record exact-SHA deployment smoke and live readiness            | OPS-001/002/003/005/006, core P1 gates            | Not started                                      | Original acceptance and verification below                                 |
| DOC-001  | Resolve contradictory agent layout guidance                     | DEC-001                                           | Not started                                      | Original acceptance and verification below                                 |
| DOC-002  | Reconcile scan timing, modes, provider and completion semantics | EDGE-006, DEC-002/003/006                         | Not started                                      | Original acceptance and verification below                                 |
| DOC-003  | Maintain owner/deployment/privacy runbooks                      | OPS-002/003/005/006, SEC-002, DEC-005             | Not started                                      | Original acceptance and verification below                                 |
| DOC-004  | Reconcile rename, license and old task artifacts                | DEC-005                                           | Not started                                      | Original acceptance and verification below                                 |
| TASK-015 | Make only justified repository organization changes             | DEC-001, stable core P1 work                      | Not started                                      | Original acceptance and verification below                                 |
| OPS-001  | Explain and repair the current preview ERROR                    | accessible build logs, BUG-001                    | Not started                                      | Original acceptance and verification below                                 |
| OPS-002  | Verify environment and Google OAuth configuration               | approved console access                           | Not started                                      | Original acceptance and verification below                                 |
| OPS-003  | Resolve daily scheduler timing/throughput and recovery SLA      | DEC-002                                           | Not started                                      | Original acceptance and verification below                                 |
| OPS-004  | Reconcile PRs, automated approvals and dependency updates       | BUG-001, target-branch decision                   | Not started                                      | Original acceptance and verification below                                 |
| OPS-005  | Rehearse migrations, schema drift and rollback safely           | TEST-001, approved disposable environment         | Not started                                      | Original acceptance and verification below                                 |
| OPS-006  | Prove monitoring and redacted failure alert delivery            | TASK-005, SEC-003                                 | Not started                                      | Original acceptance and verification below                                 |
| OPS-007  | Review database performance warnings and upgrade advisory       | TEST-001/002, OPS-005                             | Not started                                      | Original acceptance and verification below                                 |
| OPS-008  | Produce release go/no-go and rollback handoff                   | TEST-009, unresolved P1/security decisions closed | Not started                                      | Original acceptance and verification below                                 |
| DEC-001  | Authoritative repository layout and instruction hierarchy       | none                                              | Not started                                      | Original acceptance and verification below                                 |
| DEC-002  | Scheduling, continuation and retry service level                | E-05/16/19 evidence                               | Not started                                      | Original acceptance and verification below                                 |
| DEC-003  | Provider order, failover and data destination consent           | TASK-001                                          | Not started                                      | Original acceptance and verification below                                 |
| DEC-004  | Selected circular progress design and UX acceptance             | none                                              | Not started                                      | Original acceptance and verification below                                 |
| DEC-005  | Launch scope, identity/branding, license and dashboard options  | none                                              | Not started                                      | Original acceptance and verification below                                 |
| DEC-006  | Manual lookback, external Gmail changes and non-MVP boundaries  | E-01/02/08                                        | Not started                                      | Original acceptance and verification below                                 |

## Routing table

Use the least costly capable profile. Current implementation is performed by Codex in this session; no model-selection control is available here. Recommendations below are not measured prices, latency, or proof a named model ran. Visible tokens exclude hidden reasoning/tool-output variability; duration excludes external waits. High-risk security, DB and release tasks require stronger review before rollout; escalate a routine task when targeted checks fail or its scope crosses concurrency/ownership boundaries.

| Task ID  | Recommended model/profile                                  | Specialty and rationale                     | Complexity | Reasoning effort | Model work effort | Visible tokens  | Active duration | Token/time-saving note                        |
| -------- | ---------------------------------------------------------- | ------------------------------------------- | ---------- | ---------------- | ----------------- | --------------- | --------------- | --------------------------------------------- |
| TASK-001 | Human / external prerequisite; Codex for local preparation | backend/product; bounded task scope         | Medium     | medium           | Standard          | Medium (5k–15k) | 15–45 min       | Reuse existing patterns; targeted tests first |
| TASK-002 | Frontier coding model                                      | backend/product; bounded task scope         | Medium     | medium           | Standard          | Medium (5k–15k) | 15–45 min       | Reuse existing patterns; targeted tests first |
| BUG-001  | Fast generalist                                            | debugging; bounded task scope               | Low        | low              | Light             | Low (<5k)       | <15 min         | Reuse existing patterns; targeted tests first |
| BUG-003  | Frontier coding model                                      | debugging; bounded task scope               | Medium     | medium           | Standard          | Medium (5k–15k) | 15–45 min       | Reuse existing patterns; targeted tests first |
| BUG-004  | Frontier coding model                                      | debugging; bounded task scope               | High       | high             | Heavy             | High (15k–35k)  | 45–120 min      | Reuse existing patterns; targeted tests first |
| BUG-007  | Frontier coding model                                      | debugging; bounded task scope               | High       | high             | Heavy             | High (15k–35k)  | 45–120 min      | Reuse existing patterns; targeted tests first |
| BUG-008  | Frontier coding model                                      | debugging; bounded task scope               | Medium     | medium           | Standard          | Medium (5k–15k) | 15–45 min       | Reuse existing patterns; targeted tests first |
| TASK-003 | Frontier coding model                                      | backend/product; bounded task scope         | High       | high             | Heavy             | High (15k–35k)  | 45–120 min      | Reuse existing patterns; targeted tests first |
| TASK-004 | Frontier coding model                                      | backend/product; bounded task scope         | High       | high             | Heavy             | High (15k–35k)  | 45–120 min      | Reuse existing patterns; targeted tests first |
| TASK-005 | Frontier coding model                                      | backend/product; bounded task scope         | Medium     | medium           | Standard          | Medium (5k–15k) | 15–45 min       | Reuse existing patterns; targeted tests first |
| EDGE-001 | Frontier coding model                                      | reliability; bounded task scope             | High       | high             | Heavy             | High (15k–35k)  | 45–120 min      | Reuse existing patterns; targeted tests first |
| EDGE-002 | Frontier coding model                                      | reliability; bounded task scope             | High       | high             | Heavy             | High (15k–35k)  | 45–120 min      | Reuse existing patterns; targeted tests first |
| EDGE-003 | Frontier coding model                                      | reliability; bounded task scope             | High       | high             | Heavy             | High (15k–35k)  | 45–120 min      | Reuse existing patterns; targeted tests first |
| EDGE-004 | Frontier coding model                                      | reliability; bounded task scope             | High       | high             | Heavy             | High (15k–35k)  | 45–120 min      | Reuse existing patterns; targeted tests first |
| EDGE-005 | Frontier coding model                                      | reliability; bounded task scope             | High       | high             | Heavy             | High (15k–35k)  | 45–120 min      | Reuse existing patterns; targeted tests first |
| EDGE-006 | Frontier coding model                                      | reliability; bounded task scope             | High       | high             | Heavy             | High (15k–35k)  | 45–120 min      | Reuse existing patterns; targeted tests first |
| EDGE-007 | Frontier coding model                                      | reliability; bounded task scope             | High       | high             | Heavy             | High (15k–35k)  | 45–120 min      | Reuse existing patterns; targeted tests first |
| EDGE-008 | Frontier coding model                                      | reliability; bounded task scope             | High       | high             | Heavy             | High (15k–35k)  | 45–120 min      | Reuse existing patterns; targeted tests first |
| EDGE-009 | Frontier coding model                                      | reliability; bounded task scope             | High       | high             | Heavy             | High (15k–35k)  | 45–120 min      | Reuse existing patterns; targeted tests first |
| TASK-006 | Frontier coding model                                      | backend/product; bounded task scope         | Medium     | medium           | Standard          | Medium (5k–15k) | 15–45 min       | Reuse existing patterns; targeted tests first |
| TASK-007 | Frontier coding model                                      | backend/product; bounded task scope         | Medium     | medium           | Standard          | Medium (5k–15k) | 15–45 min       | Reuse existing patterns; targeted tests first |
| TASK-008 | Frontier coding model                                      | backend/product; bounded task scope         | Medium     | medium           | Standard          | Medium (5k–15k) | 15–45 min       | Reuse existing patterns; targeted tests first |
| TASK-009 | Frontier coding model                                      | backend/product; bounded task scope         | Medium     | medium           | Standard          | Medium (5k–15k) | 15–45 min       | Reuse existing patterns; targeted tests first |
| TASK-010 | Frontier coding model                                      | backend/product; bounded task scope         | High       | high             | Heavy             | High (15k–35k)  | 45–120 min      | Reuse existing patterns; targeted tests first |
| TASK-011 | Frontier coding model                                      | backend/product; bounded task scope         | High       | high             | Heavy             | High (15k–35k)  | 45–120 min      | Reuse existing patterns; targeted tests first |
| BUG-002  | Frontier coding model                                      | debugging; bounded task scope               | Medium     | medium           | Standard          | Medium (5k–15k) | 15–45 min       | Reuse existing patterns; targeted tests first |
| BUG-005  | Fast generalist                                            | debugging; bounded task scope               | Low        | low              | Light             | Low (<5k)       | <15 min         | Reuse existing patterns; targeted tests first |
| BUG-006  | Fast generalist                                            | debugging; bounded task scope               | Low        | low              | Light             | Low (<5k)       | <15 min         | Reuse existing patterns; targeted tests first |
| BUG-009  | Frontier coding model                                      | debugging; bounded task scope               | Medium     | medium           | Standard          | Medium (5k–15k) | 15–45 min       | Reuse existing patterns; targeted tests first |
| EDGE-010 | Frontier coding model                                      | reliability; bounded task scope             | High       | high             | Heavy             | High (15k–35k)  | 45–120 min      | Reuse existing patterns; targeted tests first |
| EDGE-011 | Frontier coding model                                      | reliability; bounded task scope             | High       | high             | Heavy             | High (15k–35k)  | 45–120 min      | Reuse existing patterns; targeted tests first |
| TASK-012 | Human / external prerequisite; Codex for local preparation | backend/product; bounded task scope         | Medium     | medium           | Standard          | Medium (5k–15k) | 15–45 min       | Reuse existing patterns; targeted tests first |
| TASK-013 | Frontier coding model                                      | backend/product; bounded task scope         | Medium     | medium           | Standard          | Medium (5k–15k) | 15–45 min       | Reuse existing patterns; targeted tests first |
| TASK-014 | Frontier coding model                                      | backend/product; bounded task scope         | Medium     | medium           | Standard          | Medium (5k–15k) | 15–45 min       | Reuse existing patterns; targeted tests first |
| SEC-001  | Frontier coding model                                      | security; bounded task scope                | High       | high             | Heavy             | High (15k–35k)  | 45–120 min      | Reuse existing patterns; targeted tests first |
| SEC-002  | Frontier coding model                                      | security; bounded task scope                | High       | high             | Heavy             | High (15k–35k)  | 45–120 min      | Reuse existing patterns; targeted tests first |
| SEC-003  | Frontier coding model                                      | security; bounded task scope                | High       | high             | Heavy             | High (15k–35k)  | 45–120 min      | Reuse existing patterns; targeted tests first |
| SEC-004  | Human / external prerequisite; Codex for local preparation | security; bounded task scope                | High       | high             | Heavy             | High (15k–35k)  | 45–120 min      | Reuse existing patterns; targeted tests first |
| SEC-005  | Frontier coding model                                      | security; bounded task scope                | High       | high             | Heavy             | High (15k–35k)  | 45–120 min      | Reuse existing patterns; targeted tests first |
| SEC-006  | Frontier coding model                                      | security; bounded task scope                | High       | high             | Heavy             | High (15k–35k)  | 45–120 min      | Reuse existing patterns; targeted tests first |
| SEC-007  | Frontier coding model                                      | security; bounded task scope                | High       | high             | Heavy             | High (15k–35k)  | 45–120 min      | Reuse existing patterns; targeted tests first |
| SEC-008  | Frontier coding model                                      | security; bounded task scope                | High       | high             | Heavy             | High (15k–35k)  | 45–120 min      | Reuse existing patterns; targeted tests first |
| SEC-009  | Frontier coding model                                      | security; bounded task scope                | High       | high             | Heavy             | High (15k–35k)  | 45–120 min      | Reuse existing patterns; targeted tests first |
| SEC-010  | Frontier coding model                                      | security; bounded task scope                | High       | high             | Heavy             | High (15k–35k)  | 45–120 min      | Reuse existing patterns; targeted tests first |
| TEST-001 | Human / external prerequisite; Codex for local preparation | testing; bounded task scope                 | Medium     | medium           | Standard          | Medium (5k–15k) | 15–45 min       | Reuse existing patterns; targeted tests first |
| TEST-002 | Frontier coding model                                      | testing; bounded task scope                 | High       | high             | Heavy             | High (15k–35k)  | 45–120 min      | Reuse existing patterns; targeted tests first |
| TEST-003 | Frontier coding model                                      | testing; bounded task scope                 | Medium     | medium           | Standard          | Medium (5k–15k) | 15–45 min       | Reuse existing patterns; targeted tests first |
| TEST-004 | Frontier coding model                                      | testing; bounded task scope                 | Medium     | medium           | Standard          | Medium (5k–15k) | 15–45 min       | Reuse existing patterns; targeted tests first |
| TEST-005 | Human / external prerequisite; Codex for local preparation | testing; bounded task scope                 | Medium     | medium           | Standard          | Medium (5k–15k) | 15–45 min       | Reuse existing patterns; targeted tests first |
| TEST-006 | Frontier coding model                                      | testing; bounded task scope                 | Medium     | medium           | Standard          | Medium (5k–15k) | 15–45 min       | Reuse existing patterns; targeted tests first |
| TEST-007 | Frontier coding model                                      | testing; bounded task scope                 | High       | high             | Heavy             | High (15k–35k)  | 45–120 min      | Reuse existing patterns; targeted tests first |
| TEST-008 | Frontier coding model                                      | testing; bounded task scope                 | Medium     | medium           | Standard          | Medium (5k–15k) | 15–45 min       | Reuse existing patterns; targeted tests first |
| TEST-009 | Human / external prerequisite; Codex for local preparation | testing; bounded task scope                 | Medium     | medium           | Standard          | Medium (5k–15k) | 15–45 min       | Reuse existing patterns; targeted tests first |
| DOC-001  | Fast generalist                                            | documentation/decisions; bounded task scope | Low        | low              | Light             | Low (<5k)       | <15 min         | Reuse existing patterns; targeted tests first |
| DOC-002  | Fast generalist                                            | documentation/decisions; bounded task scope | Low        | low              | Light             | Low (<5k)       | <15 min         | Reuse existing patterns; targeted tests first |
| DOC-003  | Fast generalist                                            | documentation/decisions; bounded task scope | Low        | low              | Light             | Low (<5k)       | <15 min         | Reuse existing patterns; targeted tests first |
| DOC-004  | Fast generalist                                            | documentation/decisions; bounded task scope | Low        | low              | Light             | Low (<5k)       | <15 min         | Reuse existing patterns; targeted tests first |
| TASK-015 | Frontier coding model                                      | backend/product; bounded task scope         | Medium     | medium           | Standard          | Medium (5k–15k) | 15–45 min       | Reuse existing patterns; targeted tests first |
| OPS-001  | Human / external prerequisite; Codex for local preparation | release operations; bounded task scope      | Medium     | medium           | Standard          | Medium (5k–15k) | 15–45 min       | Reuse existing patterns; targeted tests first |
| OPS-002  | Human / external prerequisite; Codex for local preparation | release operations; bounded task scope      | Medium     | medium           | Standard          | Medium (5k–15k) | 15–45 min       | Reuse existing patterns; targeted tests first |
| OPS-003  | Frontier coding model                                      | release operations; bounded task scope      | Medium     | medium           | Standard          | Medium (5k–15k) | 15–45 min       | Reuse existing patterns; targeted tests first |
| OPS-004  | Frontier coding model                                      | release operations; bounded task scope      | Medium     | medium           | Standard          | Medium (5k–15k) | 15–45 min       | Reuse existing patterns; targeted tests first |
| OPS-005  | Human / external prerequisite; Codex for local preparation | release operations; bounded task scope      | Medium     | medium           | Standard          | Medium (5k–15k) | 15–45 min       | Reuse existing patterns; targeted tests first |
| OPS-006  | Frontier coding model                                      | release operations; bounded task scope      | Medium     | medium           | Standard          | Medium (5k–15k) | 15–45 min       | Reuse existing patterns; targeted tests first |
| OPS-007  | Frontier coding model                                      | release operations; bounded task scope      | Medium     | medium           | Standard          | Medium (5k–15k) | 15–45 min       | Reuse existing patterns; targeted tests first |
| OPS-008  | Human / external prerequisite; Codex for local preparation | release operations; bounded task scope      | Medium     | medium           | Standard          | Medium (5k–15k) | 15–45 min       | Reuse existing patterns; targeted tests first |
| DEC-001  | Fast generalist                                            | documentation/decisions; bounded task scope | Low        | low              | Light             | Low (<5k)       | <15 min         | Reuse existing patterns; targeted tests first |
| DEC-002  | Fast generalist                                            | documentation/decisions; bounded task scope | Low        | low              | Light             | Low (<5k)       | <15 min         | Reuse existing patterns; targeted tests first |
| DEC-003  | Fast generalist                                            | documentation/decisions; bounded task scope | Low        | low              | Light             | Low (<5k)       | <15 min         | Reuse existing patterns; targeted tests first |
| DEC-004  | Human / external prerequisite; Codex for local preparation | documentation/decisions; bounded task scope | Medium     | medium           | Standard          | Medium (5k–15k) | 15–45 min       | Reuse existing patterns; targeted tests first |
| DEC-005  | Human / external prerequisite; Codex for local preparation | documentation/decisions; bounded task scope | Medium     | medium           | Standard          | Medium (5k–15k) | 15–45 min       | Reuse existing patterns; targeted tests first |
| DEC-006  | Fast generalist                                            | documentation/decisions; bounded task scope | Low        | low              | Light             | Low (<5k)       | <15 min         | Reuse existing patterns; targeted tests first |

## Detailed remaining task cards

### TASK-001 — Diagnose the two all-failure live scans

- **P1 · EPIC-003 · owner: agent + Vercel/AI dashboard owner · status: blocked · dependencies: none.**
- **Problem/why:** E-19 proves 699 and 63 failed threads with zero analysis, but generic PARTIAL does not establish provider, schema, DB, or Gmail root cause. Cursor completion alone hides an unusable product.
- **Evidence/files/systems:** E-04, E-09, E-12, E-17, E-19; production scan/provider events, redacted error codes, environment-variable names/model/provider configuration. Runtime logs API was billing-blocked.
- **Steps:** obtain the bounded redacted logs for those scan times; correlate scan/job IDs and provider/schema/fetch/persist outcomes; compare deployed SHA/config with working tree; reproduce the smallest failing contract using synthetic content only; open a narrowly scoped root-cause fix with its regression test.
- **Acceptance:** one evidence-backed causal explanation per incident and a reproducer; no unsupported claim that quota or a model caused it; a synthetic rerun demonstrates successful analysis and correct failure handling after the approved fix.
- **Tests/verification:** TEST-004/005/009; inspect metadata and a redacted provider contract result. Do not send personal email to a new provider or expose keys. Record access failure rather than enabling a paid plan.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.

### TASK-002 — Complete and reconcile historical context inventory

- **P2 · EPIC-001 · owner: agent + project owner · status: partial · dependencies: none.**
- **Problem/why:** visible chat lists are bounded, not exhaustive; old promises can be lost or duplicated.
- **Evidence/files:** Section 2 chat table; E-01/02/13/15; earlier hidden chat pages/exports only if available.
- **Steps:** retrieve remaining relevant history through supported pagination/export; map each requirement to implemented, open, duplicate, superseded, or decision-needed; attach source chat ID/date and current code proof; add genuinely new tasks to this plan once.
- **Acceptance:** all available relevant chats are reconciled, with unavailable pages explicitly listed; no unrelated project chats or stale bugs added to the backlog.
- **Tests/verification:** cross-check chat-to-task map against current Git/source; verify unique IDs and links, then `npm run format:check`.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.

### BUG-001 — Repair the checkpoint regression test harness

- **P1 · EPIC-002 · owner: agent · status: open · dependencies: none.**
- **Problem/why:** full suite fails two `saves a consistent completed batch ... AI succeeds true/false` tests. Memory `updateScanRun` omits action/reply/waiting/informational/ignored counters; callback assertions then throw inside the production thread-failure catch.
- **Evidence/files:** E-04; test helper around lines 292–353 and assertions 449–491. Production store already copies these counters. Static diagnosis is high-confidence; no repair/rerun was made here.
- **Steps:** align memory persistence with real store; observe checkpoint state without letting observer assertions masquerade as Gmail errors; preserve assertions for cursor, counters and failures; distinguish true production failures if they remain.
- **Acceptance:** both variants pass without relaxing expectations; tests fail again if persistence is intentionally broken.
- **Tests/verification:** `npm test -- src/lib/scans/process-scan.test.ts src/lib/scans/store.test.ts`; then `npm test`. Safest first implementation task.

- **Execution status:** Complete locally. See `01-CHANGED-AND-ADDED.md`; targeted 35/35 and full 459/459 tests passed. Original audit evidence above is historical.

### BUG-003 — Do not disconnect Gmail on transient refresh failure

- **P1 · EPIC-002 · owner: agent · status: open · dependencies: none.**
- **Problem/why:** `createGmailApi` converts every `getAccessToken` exception to reauth-required; callers persist REAUTH_REQUIRED. Network/5xx failures can unnecessarily disable a valid connection.
- **Evidence/files:** E-07; `createGmailApi`, `createGmailApiForUser`, `createGmailApiForConnection`.
- **Steps:** classify real revoked/invalid credentials separately from transient failures; preserve connection status for retryable errors; use safe user-visible codes and bounded retries.
- **Acceptance:** revoked token requires reconnect; network/503 does not change CONNECTED to REAUTH_REQUIRED; neither case leaks token/error bodies.
- **Tests/verification:** table-driven refresh tests for invalid_grant, timeout, network, 429/503 and successful refresh; targeted Gmail client tests via `npm test -- <new-test-path>` after creating them, then integration suite.

- **Execution status:** Complete locally. See `01-CHANGED-AND-ADDED.md`; targeted 27/27 and typecheck passed. Real Gmail/database integration remains a separate release gate.

### BUG-004 — Release admitted leases when scan preparation fails

- **P1 · EPIC-002 · owner: agent · status: open · dependencies: BUG-001.**
- **Problem/why:** manual checkpoint resume prepares the provider/settings/scan outside cleanup handling. Preparation failure leaves an admitted lease until expiry; new-run marking failures have related cleanup gaps.
- **Evidence/files:** E-05; `beginManualInitialScan` resume branch and `markScanJobRunning`; E-04 `openGmailScan` insert followed by connection update.
- **Steps:** give each admitted path a consistent ownership-checked cleanup boundary; terminate the job on preparation failure; preserve a resumable checkpoint where appropriate; handle failed post-insert bookkeeping without orphan RUNNING records.
- **Acceptance:** injected failure at every preparation/write step leaves no active orphan lease; another legitimate request can proceed or resume immediately; healthy checkpoint data is not discarded.
- **Tests/verification:** `npm test -- src/lib/scans/manual.test.ts src/lib/scans/continue.test.ts src/lib/scans/jobs.test.ts src/lib/scans/process-scan.test.ts`; TEST-002 real admission cases.

- **Execution status:** Complete locally. Preparation failures, orphan cleanup and successor fencing tested; 57/57 targeted plus typecheck passed. Actual concurrent database tests remain TEST-002.

### BUG-007 — Bound Gmail calls and retries by the slice deadline

- **P1 · EPIC-002 · owner: agent · status: open · dependencies: BUG-001.**
- **Problem/why:** Gmail SDK calls have no explicit deadline; retry waits can consume 180s before request time. Checking elapsed budget only before a call cannot prevent an invocation overrun. This mechanism is source-verified; it is not proven to explain the historical incident.
- **Evidence/files:** E-04/05/07; retry wrapper, OAuth exchange/refresh, Gmail list/get/modify, quota wait, work budget.
- **Steps:** pass remaining deadline/cancellation through SDK request/retry/quota boundaries; stop admission early enough to persist; cap retries and wait by remaining headroom; safely checkpoint interrupted work.
- **Acceptance:** never-resolving Gmail/refresh calls and repeated 429/503 finish within the slice headroom; no skipped prefix, duplicate labels, or false success; recovery remains possible.
- **Tests/verification:** fake-clock deadline tests at each boundary; `npm test -- src/lib/gmail/retry.test.ts src/lib/scans/process-scan.test.ts src/lib/scans/continue.test.ts`; TEST-007 termination simulation, then build/integration.

- **Execution status:** Implemented and locally verified, not fully closed. Shared request/refresh/retry/quota/provider deadlines and safe continuation tested; 537 full tests, integration 17, eval 2, typecheck/lint/build pass. TEST-007 real process-kill/database termination gate remains unverified; see root change report. No production success claim.

### BUG-008 — Distinguish failed analysis from normal FYI

- **P1 · EPIC-003 · owner: agent + product owner · status: open · dependencies: TASK-001.**
- **Problem/why:** E-19 establishes all-failure results; E-04 persists a new thread with default informational status when analysis is null. This can make unavailable analysis look like a successful FYI decision.
- **Evidence/files:** E-04 `upsertThread` and message persistence, E-06 history/progress, E-10 read models, E-19. Exact affected production screen is unverified.
- **Steps:** retain a clearly distinguishable analysis-unavailable state/metadata without inventing another canonical bucket; exclude it from claims of useful classified FYI; show successful/failed/skipped counts and recovery action; agree product wording.
- **Acceptance:** failed AI never creates a false action or Gmail label and never appears as an explicitly classified FYI; partial/zero-success runs are unmistakable; previous valid analysis remains intact.
- **Tests/verification:** unit/read-model/component tests for new/previously analyzed failures, all-failure and mixed batches; `npm test -- src/lib/scans/store.test.ts src/lib/mail/buckets.test.ts`; authenticated synthetic smoke TEST-009.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.

### TASK-003 — Finish verification of the existing checkpoint/pool patch

- **P1 · EPIC-002 · owner: agent · status: partial · dependencies: BUG-001, BUG-007.**
- **Problem/why:** the eight existing dirty files aim to persist completed batches, drain admitted workers and bound continuation; this work must be finished, not replaced with a second redesign.
- **Evidence/files:** E-04/05/14; pool.test.ts, pool.ts, continue.ts/test, scan-integration.test.ts.
- **Steps:** review the exact diff with the owner; add out-of-order completion, active-worker drain, hard-kill and continuation timeout/DB-failure assertions; preserve cursor/counters/failure IDs atomically; benchmark the slowest-worker batch barrier before changing it.
- **Acceptance:** contiguous durable prefix never skips unfinished work; restart preserves all counters; continuation failure has a durable retry path; no unbounded worker admissions after failure.
- **Tests/verification:** `npm test -- src/lib/scans/pool.test.ts src/lib/scans/process-scan.test.ts src/lib/scans/continue.test.ts`; all existing gates; TEST-002/007. Agent must not commit or deploy without a subsequent request.

- **Execution status:** Local accounting implementation verified: same-row scan attribution recovers out-of-prefix analysis counts; live progress cannot overwrite durable message counters; rejected checkpoints stop admissions. 76 targeted tests PASS (68 combined + 8 fallback); typecheck/lint PASS. New migration is drafted only and must precede deployment after approved disposable-database rehearsal. TASK-003 remains partially verified until actual hard-kill/SQL/fencing TEST-001/002/007 and EDGE-001 pass. Pool barrier unchanged; no optimization benchmark claim.

### TASK-004 — Make continuation/retry independent of an open browser

- **P1 · EPIC-002 · owner: agent + project owner · status: partial · dependencies: BUG-004, BUG-007, DEC-002.**
- **Problem/why:** self-continuation, browser auto-resume and five-minute fallback due time exist, but daily cron does not guarantee a five-minute rescue. A closed tab must not strand a large scan.
- **Evidence/files:** E-05/06; E-16/17; official daily-cron limits cited under OPS-003.
- **Steps:** select an approved no-cost-compatible recovery service level; use durable checkpoints/leases and bounded attempts; reconcile job failure with still-resumable scan state; add server-triggered recovery or explicitly document the current next-run/manual limitation.
- **Acceptance:** chosen recovery promise is demonstrably met with the browser closed; healthy slices are not resumed concurrently; exhausted attempts and final failures are visible.
- **Tests/verification:** TEST-002/007/009; closed-tab synthetic scan, delayed/failed self-fetch, stale lease and daily-only fallback. No new paid scheduler without owner approval.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.

### TASK-005 — Record redacted per-thread failure reasons and retry policy

- **P1 · EPIC-002 · owner: agent · status: open · dependencies: TASK-001, DEC-002.**
- **Problem/why:** failed IDs/generic partial code cannot explain why every thread failed or whether a retry is queued.
- **Evidence/files:** E-04/05/09/12/19; thread-failures.ts, scan events and checkpoint migration.
- **Steps:** attach bounded reason codes/stage/provider/model/attempt counts to scan failure metadata; classify retryable versus permanent/schema/deleted-thread outcomes; set explicit retry state/time and cap attempts; sanitize event payloads.
- **Acceptance:** every failed thread has a safe diagnostic category and explicit next action; completed work is not needlessly re-analyzed; no email body, subject, token or prompt appears in logs.
- **Tests/verification:** failure-reason/retry cap/redaction tests, `npm test -- src/lib/scans/thread-failures.test.ts src/lib/observability/events.test.ts src/lib/observability/sentry-privacy.test.ts`; inspect synthetic metadata.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.

### EDGE-001 — Crash between writes and durable checkpoint

- **P1 · EPIC-002 · owner: agent · status: needs verification · dependencies: BUG-001, TASK-003.**
- **Problem/why:** DB/message/action/label writes precede checkpoint completion; process death can repeat a thread. Existing mocks do not establish real-DB idempotency.
- **Evidence/files:** E-04/05/08/11; store upserts, uniqueness constraints and contiguous cursor.
- **Steps:** interrupt before/after each persistence boundary, restart from checkpoint, compare final rows/labels/counts; repair only reproduced gaps.
- **Acceptance:** replay creates no duplicate action/message/digest/managed label and loses no unfinished thread; counters match final canonical data.
- **Tests/verification:** TEST-002/007 using disposable DB and synthetic Gmail; targeted scan/store/reconcile tests plus integration.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.

### EDGE-002 — Simultaneous tabs, cron, manual scan and continuation

- **P1 · EPIC-002 · owner: agent · status: needs verification · dependencies: BUG-004.**
- **Problem/why:** a source lease/unique guard needs real concurrent admission proof; process-local runtime maps are not distributed locks.
- **Evidence/files:** E-05/11; 0008 admission migration and jobs/leases.
- **Steps:** race two users' own requests and multiple triggers for one connection, including stale worker finishing after takeover; enforce DB ownership fencing at every state change.
- **Acceptance:** at most one active writer per connection; losers receive correct conflict/rate-limit responses; stale worker cannot finish a successor's job.
- **Tests/verification:** TEST-002 actual concurrent SQL/API and fake-worker tests; `npm test -- src/lib/scans/jobs.test.ts src/lib/scans/manual.test.ts`.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.

### EDGE-003 — Cancellation/deletion while a worker is in flight

- **P1 · EPIC-004 · owner: agent · status: needs verification · dependencies: TASK-003, TEST-001.**
- **Problem/why:** non-atomic status checks followed by writes can race cancel/deletion, including the AI-failure persistence branch. This is a consistency/privacy risk, not a confirmed cross-user exploit.
- **Evidence/files:** E-04/05/11; cancellation/lease checks, deletion ordering, Gmail label mutations.
- **Steps:** pause at every await around AI/store/action/label writes; cancel/delete a disposable account; resume the worker; add transactional or ownership-fenced writes only where needed.
- **Acceptance:** cancelled/deleted jobs never resurrect rows or mutate Gmail after cancellation is acknowledged; retries of cleanup are safe and observable.
- **Tests/verification:** TEST-002/007/008; deletion tests plus controlled disposable-account teardown with explicit approval before deletion.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.

### EDGE-004 — Discovery pagination interrupted before discovery_complete

- **P1 · EPIC-002 · owner: agent · status: needs verification · dependencies: BUG-007.**
- **Problem/why:** full discovery happens before processing; large paginated inboxes, duplicated events and an interrupted list need bounded restart behavior.
- **Evidence/files:** E-04/08/11; discovered_thread_ids/history_boundary/discovery_complete.
- **Steps:** test many list/history pages, duplicate IDs, empty pages, deadline/429 after a page and restart; checkpoint partial discovery if required by measured limits.
- **Acceptance:** bounded discovery can resume or safely rediscover without missing/duplicating work; persisted boundary precedes new mail correctly.
- **Tests/verification:** targeted process/history/recovery/checkpoint tests; TEST-005/007.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.

### EDGE-005 — New inbound arrives during scan/history recovery

- **P1 · EPIC-002 · owner: agent · status: needs verification · dependencies: TASK-003.**
- **Problem/why:** source snapshots history before discovery and advances only after SUCCESS; actual replay/overlap correctness still needs integration proof.
- **Evidence/files:** E-04/08; history boundary and 404/410 recovery.
- **Steps:** inject inbound after boundary, while paginating and before terminal write; repeat after PARTIAL; test stale history with overlap and unchanged content hashes.
- **Acceptance:** new inbound appears on this or next successful scan, never falls between boundaries; unchanged threads avoid unnecessary AI; partial failures remain retryable.
- **Tests/verification:** `npm test -- src/lib/gmail/history-list.test.ts src/lib/gmail/recovery.test.ts src/lib/scans/process-scan.test.ts`; TEST-005.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.

### EDGE-006 — Stale timestamps and misleading job/scan status combinations

- **P1 · EPIC-002 · owner: agent · status: open · dependencies: TASK-004/005.**
- **Problem/why:** 20-minute progress stale, 270s lease, 330s UI resume and five-minute fallback mean different things. Job SUCCESS with scan PARTIAL is currently real.
- **Evidence/files:** E-05/06/19; timestamps/lease/status read models.
- **Steps:** document and test one explicit state machine; distinguish slice completion, scan success, partial analysis, cancellation and retry; use server timestamps and versioned snapshots.
- **Acceptance:** every combination has one recovery owner and truthful UI; clock skew or a slow heartbeat cannot start a second healthy worker.
- **Tests/verification:** state table tests, fake clocks and TEST-002; targeted timestamps/jobs/progress tests.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.

### EDGE-007 — Deleted/stale managed labels and legacy rename

- **P1 · EPIC-003 · owner: agent · status: needs verification · dependencies: TEST-005.**
- **Problem/why:** a deleted Gmail label leaves a stored ID; legacy `AI/*` and current `MailPilot/*` mappings need safe reconciliation.
- **Evidence/files:** E-08/01; ensureManagedLabels/loadLabelMap/label-plan and decision overlay.
- **Steps:** test missing/renamed/deleted managed labels; reconcile once with bounded API calls; handle duplicate legacy/current labels without touching unrelated user labels.
- **Acceptance:** managed labels recover or show an actionable error; validated analysis precedes mutations; no user label is removed/renamed by this repair.
- **Tests/verification:** label-plan unit tests plus TEST-005 dedicated label sandbox. Google scope/consent remain unchanged.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.

### EDGE-008 — MIME, aliases, attachments, multilingual and long threads

- **P1 · EPIC-003 · owner: agent · status: partial · dependencies: TEST-004/005.**
- **Problem/why:** existing parsers/context limits/tests cover parts of the spec, not every real-world combination.
- **Evidence/files:** E-02/08/09; parser, addresses, aliases and bounded context.
- **Steps:** add fixtures for display-name From, alias/self-sent/BCC, forwarded/empty/HTML-only/malformed MIME, no subject, many recipients/mailing list, Hebrew/RTL/mixed language, long/truncated threads and attachment-only requests; do not invent attachment contents.
- **Acceptance:** sender/waiting ownership and latest unresolved action remain correct; limits are enforced; unsupported attachment inspection is disclosed; no unsafe HTML/URLs rendered.
- **Tests/verification:** parser/addresses/aliases/context unit fixtures and TEST-004 classification matrix; `npm test -- src/lib/gmail/parser.test.ts src/lib/gmail/thread-context.test.ts src/lib/ai/eval-scorecard.test.ts`.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.

### EDGE-009 — Deletions, Trash and label-only history events

- **P2 · EPIC-003 · owner: project owner then agent · status: blocked · dependencies: DEC-006.**
- **Problem/why:** incremental discovery listens to messageAdded; product expectations for external deletion/Trash/label changes must be explicit before broadening sync.
- **Evidence/files:** E-02/08; historyTypes and SPAM/TRASH exclusion.
- **Steps:** decide supported external-state sync semantics; test deleted thread 404, moved-to-Trash mail and label-only events; implement only the chosen behavior and retention policy.
- **Acceptance:** UI stale/deleted records behave as documented; unsupported event types are not silently promised; new inbound/partial retries still work.
- **Tests/verification:** history/recovery/Gmail contract fixtures, TEST-005 and authenticated read-model checks.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.

### TASK-006 — Establish a representative classification quality gate

- **P1 · EPIC-003 · owner: agent + project owner · status: partial · dependencies: TASK-001.**
- **Problem/why:** deterministic scorecard success does not measure current live Gemini/NVIDIA responses or genuine mailbox accuracy.
- **Evidence/files:** E-01/09/10; categories, notices, eval fixtures and canonical buckets.
- **Steps:** agree redacted/synthetic gold cases for Open/Pending/FYI/Ignore; include paid receipt vs unpaid invoice, OTP vs real account alert, already-completed vs new inbound, CC-only tasks, assessment/scheduling, portal document and malicious instructions; measure per-bucket false positives/negatives on opt-in live provider results.
- **Acceptance:** agreed thresholds recorded; no synthetic stub results reported as live accuracy; schema rejection never causes labels/actions; each fixture has one canonical expected bucket.
- **Tests/verification:** `npm run eval:scorecard`; TEST-004 approved live benchmark without personal mail/cross-provider transmission.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.

### TASK-007 — Add optional bounded runtime failover only after decision

- **P2 · EPIC-003 · owner: agent + project owner · status: blocked · dependencies: TASK-001, DEC-003, TEST-004.**
- **Problem/why:** requested provider overflow is not implemented; current selector does not retry NVIDIA failures through Gemini or alternate credentials.
- **Evidence/files:** E-09 and NVIDIA chat; credential configuration and provider interfaces.
- **Steps:** if approved, define failover-eligible errors, global attempt/deadline budget and per-provider circuit/cooldown; isolate credentials; validate same output schema; redact key identifiers and document destination consent. Otherwise explicitly keep single-provider selection.
- **Acceptance:** no retry storm, silent provider switch or unbounded cost; cancellation propagates; permanent auth/schema errors obey policy; key rotation is not used to bypass provider limits/terms.
- **Tests/verification:** deterministic provider failure/429/503/malformed-output tests, TEST-004; audit attempt/cost metadata and source diff. No model/provider recommendation is a pricing guarantee.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.

### TASK-008 — Benchmark and bound scan efficiency

- **P2 · EPIC-003 · owner: agent · status: open · dependencies: BUG-007, TASK-003/005.**
- **Problem/why:** batch barriers wait for the slowest worker; process-local quota bucket may contend across inboxes and cannot enforce a distributed quota. Optimize measured bottlenecks, not just concurrency.
- **Evidence/files:** E-04/07/08/09; AI concurrency, content hashes and message/context caps.
- **Steps:** measure discovery/fetch/AI/store/label latency, retries, skipped unchanged threads and requests per synthetic 100/700-thread scan; tune bounded concurrency with headroom; separate per-connection fairness from global provider limits; cache only safe stable data.
- **Acceptance:** comparable benchmark shows improvement without missed checkpoints, cross-user starvation, larger prompts or higher uncontrolled request/cost rate; limits remain configurable and conservative.
- **Tests/verification:** repeatable benchmark plus TEST-002/004/005/007; targeted pool/quota/content-hash tests. No dependency or infrastructure addition unless justified and approved.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.

### TASK-009 — Preserve manual overrides across re-analysis

- **P1 · EPIC-003 · owner: agent · status: needs verification · dependencies: TEST-004.**
- **Problem/why:** user completion/snooze/corrections must beat unchanged AI, while new inbound can create a genuine new next step.
- **Evidence/files:** E-01/04/10; content hashes, reconcile-action, next-state, feedback corrections and bucket reads.
- **Steps:** exercise full transitions Open→completed/snoozed, Open→Pending, Pending→Open, Summary↔Open, Ignore↔valid action; rerun unchanged and changed threads; decide override reset rules only where ambiguous.
- **Acceptance:** one action and one canonical bucket; no completed item resurrected by unchanged content; new inbound behavior and waiting ownership match product decisions.
- **Tests/verification:** `npm test -- src/lib/actions/reconcile-action.test.ts src/lib/actions/next-state.test.ts src/lib/mail/buckets.test.ts src/lib/threads/apply-feedback.test.ts`; TEST-006 authenticated scenarios.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.

### TASK-010 — Make feedback/canonical state changes consistent

- **P1 · EPIC-004 · owner: agent · status: open · dependencies: TEST-001/003.**
- **Problem/why:** saveThreadFeedback inserts feedback, updates thread then updates/inserts action separately. A later failure can leave canonical thread/action state inconsistent.
- **Evidence/files:** E-10 `saveThreadFeedback`, lines 258–321; failure-path correctness source-verified, runtime reproduction not performed.
- **Steps:** inject each intermediate write failure and concurrent scan correction; implement the smallest transactional/idempotent ownership-checked operation; reconcile any reproduced inconsistent test state.
- **Acceptance:** operation fully applies or returns an explicit recoverable failure without conflicting buckets/action states; retry creates no duplicates; user ownership enforced in DB and API.
- **Tests/verification:** targeted thread queries/reconcile tests, actual transactional SQL/API TEST-001/003 and UI count/bucket check.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.

### TASK-011 — Prevent lost updates from simultaneous user/scan actions

- **P1 · EPIC-004 · owner: agent · status: needs verification · dependencies: TEST-002/003, TASK-009.**
- **Problem/why:** patchActionForUser reads then updates without a version comparison; concurrent complete/snooze/AI writes can overwrite a newer intent.
- **Evidence/files:** E-10 action mutation and scan reconciliation.
- **Steps:** reproduce races; introduce minimal optimistic version/CAS or transaction semantics where needed; define stale-request response and retry behavior.
- **Acceptance:** later acknowledged user intent is not silently overwritten; conflicting stale requests receive a predictable response; manual_override remains authoritative.
- **Tests/verification:** parallel action/scan tests plus `npm test -- src/lib/actions/mutations.test.ts src/lib/actions/reconcile-action.test.ts`; TEST-003/006.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.

### BUG-002 — Stop repeated successful-null scan polling

- **P1 · EPIC-005 · owner: agent · status: open · dependencies: none.**
- **Problem/why:** tick resets nullPolls before checking a null scan. Repeated HTTP 200 `{scan:null}` never reaches POLL_NULL_LIMIT, leaving an indefinite checking state.
- **Evidence/files:** E-06 initial-scan-card.tsx lines 185–189.
- **Steps:** count consecutive invalid/absent snapshots correctly; reset only after a valid snapshot; render a bounded recoverable error and clean up the timer.
- **Acceptance:** three null snapshots stop/recover as intended; valid data resets the count; no duplicate timers or updates after unmount.
- **Tests/verification:** component fake-timer cases for 200/null, malformed JSON, failed fetch, recovery and unmount; `npm test -- <new-component-test-path>` after adding test; TEST-006.

- **Execution status:** Complete locally. Cursor C01 independently reviewed and accepted; matching/reset/null/malformed and terminal regressions pass within the 50-test owned subset.

### BUG-005 — Remove false “Retries queued” guarantees

- **P1 · EPIC-005 · owner: agent · status: open · dependencies: TASK-005, EDGE-006.**
- **Problem/why:** PARTIAL always prints “Retries queued” in card/progress even when terminal job is SUCCESS and no active retry is evidenced; users may wait for work that is not queued.
- **Evidence/files:** E-06 initial-scan-card.tsx line 404 and scanProgressView; E-19 actual status combination.
- **Steps:** render explicit retry state/time only from durable server data; otherwise offer truthful next action; separate checked, successfully analyzed and failed counts.
- **Acceptance:** queued language is used only for an actual admitted/scheduled retry; zero-success scans do not imply completion; copy never relies on PARTIAL alone.
- **Tests/verification:** progress/component tests across partial+queued/not-queued/retry-exhausted/all-failed; TEST-006/009.

- **Execution status:** UI-only copy completed and accepted through Cursor C04. Backend retry-stage/provider/attempt policy and scheduling proof remain not started; retain original dependencies.

### BUG-006 — Give empty terminal scans an actual terminal view

- **P2 · EPIC-005 · owner: agent · status: open · dependencies: none.**
- **Problem/why:** scanProgressView handles total<=0 before SUCCESS, returning indeterminate “Finding conversations” for empty completed scans. Current card may hide the bar, limiting impact but not fixing helper semantics.
- **Evidence/files:** E-06 progress.ts.
- **Steps:** handle zero-result SUCCESS/PARTIAL/cancel states before discovery; define empty successful result copy.
- **Acceptance:** zero-thread SUCCESS is determinate and completed, RUNNING discovery remains indeterminate; cancel/error does not look successful.
- **Tests/verification:** `npm test -- src/lib/scans/progress.test.ts`; component zero-result regression.

- **Execution status:** Complete locally. Cursor C03 independently accepted: zero-total SUCCESS/PARTIAL/FAILED terminal views and ARIA assertions pass.

### BUG-009 — Do not present failed DB reads as “no changes”

- **P2 · EPIC-005 · owner: agent · status: open · dependencies: TEST-003.**
- **Problem/why:** dashboard query converts database errors into empty rows, hiding an unavailable service as an empty valid dashboard. Some scan read helpers similarly swallow errors.
- **Evidence/files:** E-10 getDashboardChangesForUser; E-05 latest-scan reads. Source verified; incident not reproduced.
- **Steps:** return typed safe failure states, keep previous data where appropriate, add bounded retry/error UI; distinguish not-found/no-data from unavailable DB.
- **Acceptance:** DB failure shows a retryable error, not a false empty success; no raw DB details exposed; genuine empty inbox remains friendly.
- **Tests/verification:** dashboard/query/component tests for DB error, empty, stale data, recovery; targeted tests and TEST-006.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.

### EDGE-010 — Overlapping polls, refresh, navigation and hanging fetch

- **P1 · EPIC-005 · owner: agent · status: needs verification · dependencies: BUG-002.**
- **Problem/why:** 800ms async interval can overlap; UI start/latest/cancel fetches lack deadlines; late responses can overwrite newer state after refresh/unmount.
- **Evidence/files:** E-06 fetchLatest/startScan/cancel/tick/resumeStalled.
- **Steps:** use single-flight polling, abort/deadline and snapshot ordering; test two tabs, slow response, visibility change, refresh and unmount; recover state from server rather than local counters.
- **Acceptance:** no stale response regresses progress or fires duplicate resume; hangs end with safe retry; cancellation UI remains truthful; timer/request cleanup is complete.
- **Tests/verification:** fake timers/deferred-response component tests plus TEST-006 slow-network/tab-refresh scenarios.

- **Execution status:** Local fixes accepted after Cursor review corrections, not live browser certification. Owned tests 50/50 cover bounded serial requests, Strict Mode, start/cancel/resume races and cleanup. Authenticated-session gates remain external.

### EDGE-011 — Expired sessions during long flows

- **P1 · EPIC-005 · owner: agent · status: needs verification · dependencies: TEST-003/006.**
- **Problem/why:** signed-out dashboard guard was verified, but expiry during scan/feedback/settings and refresh-token recovery were not exercised.
- **Evidence/files:** E-12 auth/proxy and E-21 public redirect; API auth guards.
- **Steps:** expire/revoke a disposable session between page load and mutation; ensure refresh or explicit login redirect with safe return path; stop polling without losing server scan state.
- **Acceptance:** unauthorized mutations fail, no infinite spinner/raw HTML parsing error; safe login return and checkpoint resume; Gmail consent remains separate.
- **Tests/verification:** TEST-003 API 401/403 and TEST-006 session-expiry browser tests; redirects tests.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.

### TASK-012 — Verify the complete authenticated journey

- **P1 · EPIC-005 · owner: agent + project owner · status: blocked · dependencies: TASK-001, TEST-003, disposable account access.**
- **Problem/why:** public screenshots cannot establish dashboard/onboarding correctness.
- **Evidence/files:** E-01/06/10/21; onboarding, connection, settings, dashboard, thread detail, digest, logout/reconnect/privacy pages.
- **Steps:** sign up/confirm/login via email and Google identity; connect Gmail only via explicit consent; scan synthetic messages; inspect detail/deep link, bucket filters/counts, feedback/undo/completion/snooze, settings, logout/recovery, disconnect/reconnect; reserve deletion for separately approved disposable test.
- **Acceptance:** no blocked or misleading step; labels/buckets/counts match server records; loading/empty/error/success/partial paths documented with screenshots; no unrequested consent or mailbox mutation.
- **Tests/verification:** TEST-006/009 signed-in browser matrix with exact SHA/provider/environment recorded.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.

### TASK-013 — Responsive, keyboard, RTL and accessibility acceptance

- **P2 · EPIC-005 · owner: agent + project owner · status: partial · dependencies: TASK-012.**
- **Problem/why:** 391px public login passed visual overflow check; full authenticated usability remains unverified.
- **Evidence/files:** E-21 and UX chat; layout/components, scan progress live region, dialogs and forms.
- **Steps:** test 360/391/768/1440px, 200% zoom, keyboard/focus return, dialog escape, screen-reader labels/live progress, reduced motion, dark/light contrast, long Hebrew/RTL titles and empty/large lists; fix measured defects using existing components.
- **Acceptance:** primary actions remain reachable, no clipped/overflowing content or trapped focus; state communicated without color alone; audit findings resolved with before/after captures.
- **Tests/verification:** TEST-006 component/browser accessibility assertions plus manual keyboard/screen-reader/contrast review. Do not claim WCAG certification from screenshots alone.

- **Execution status:** Scan-component accessibility subset passes local assertions. Full-product accessibility, real narrow viewport and 200% zoom remain unverified; no site-wide completion claim.

### TASK-014 — Apply the requested scan/workspace UX polish narrowly

- **P2 · EPIC-005 · owner: agent + project owner · status: blocked · dependencies: DEC-004, BUG-002/005/006, TASK-012/013.**
- **Problem/why:** prior chat requests detailed premium spacing/layout and a chosen circular scan option; reference image is unavailable.
- **Evidence/files:** UX/ScanProb chats, E-06; current design primitives and inbox workspace.
- **Steps:** obtain selected visual reference; agree spacing/type/action hierarchy and progress semantics; implement one measured screen at a time; reuse existing UI library; request approval before adding animation dependencies.
- **Acceptance:** matches agreed reference on desktop/mobile; no change to product buckets or permission flow; truthful counts/states, reduced-motion fallback and regression screenshots.
- **Tests/verification:** relevant component tests, TEST-006, lint/typecheck/build after any TSX changes.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.

### SEC-001 — Prove two-user database isolation

- **P1 · EPIC-004 · owner: agent + Supabase owner · status: needs verification · dependencies: none.**
- **Problem/why:** static SQL-string tests plus RLS flags are not actual isolation tests; admin server queries bypass RLS and require their own ownership checks.
- **Evidence/files:** E-11/12/18; policies/views/functions including feedback and connection/token surfaces.
- **Steps:** execute TEST-001 with user A/B JWTs and anonymous/service-role roles; test SELECT/INSERT/UPDATE/DELETE, foreign thread/connection IDs, view columns, RPC grants; fix only proven gaps and preserve safe function search paths.
- **Acceptance:** A/anonymous cannot read/change B's resources or privileged token/function data; allowed self operations succeed; API ownership enforced even under admin client.
- **Tests/verification:** actual SQL/API assertions in disposable DB, not production mutation; TEST-001/003. Use [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security) for policy semantics.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.

### SEC-002 — Verify deletion, retention and token revocation end to end

- **P1 · EPIC-004 · owner: agent + project owner · status: partial · dependencies: EDGE-003, TEST-001.**
- **Problem/why:** mocked cleanup passes, but in-flight writes, failure midway, provider revoke and auth cleanup need real proof.
- **Evidence/files:** E-11/12; deletion ports, consent confirmations, auth account and Gmail revoke.
- **Steps:** map delete-data vs disconnect vs delete-account promises; test each failure boundary/retry with disposable records; inspect remaining rows/job leases, auth session and Gmail access; align policy retention text.
- **Acceptance:** no token/body retained beyond documented policy; deletion is idempotent and cannot be undone by a running scan; revoke failure is explicitly handled; other accounts untouched.
- **Tests/verification:** deletion unit/integration and TEST-008 disposable teardown. Permanent deletion requires explicit approval at execution time.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.

### SEC-003 — Keep secrets and personal data out of browser/logs

- **P1 · EPIC-004 · owner: agent · status: needs verification · dependencies: none.**
- **Problem/why:** source guards/redaction exist but browser bundle, error paths and provider response logging need regression coverage.
- **Evidence/files:** E-12; server-only admin/env/encryption, Sentry privacy and event allowlists; E-09 provider payloads.
- **Steps:** assert server-only import boundaries; scan built client artifacts for synthetic secret canaries and sensitive variable use; test nested error/header/request/AI data redaction; retain only necessary bounded metadata.
- **Acceptance:** no service-role/encryption/provider key or raw body/prompt reaches browser, analytics or Sentry; tests detect deliberate regression without printing real secrets.
- **Tests/verification:** `npm test -- src/lib/observability/sentry-privacy.test.ts src/lib/observability/events.test.ts src/lib/config/env.test.ts`; TEST-008 plus build artifact inspection.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.

### SEC-004 — Address leaked-password protection advisor warning

- **P2 · EPIC-004 · owner: Supabase dashboard/project owner · status: open · dependencies: DEC-005.**
- **Problem/why:** live Auth leaked-password protection is disabled; password accounts lack that extra protection.
- **Evidence/files:** E-20; [Supabase password security documentation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- **Steps:** verify project eligibility/cost and current signup/reset rules; enable only if owner approves availability/cost; otherwise record compensating policy/limitation without disabling other protections.
- **Acceptance:** warning resolved or consciously accepted with rationale; normal signup/reset/Google identity unaffected.
- **Tests/verification:** re-run advisor and disposable password signup/reset validation; no password change entered by the agent on the user's behalf.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.

### SEC-005 — Exercise malicious email/output and unsafe links

- **P1 · EPIC-004 · owner: agent · status: partial · dependencies: TEST-004.**
- **Problem/why:** email/AI output is untrusted even when JSON-valid; schema tests alone do not prove correct semantic placement or safe rendering.
- **Evidence/files:** E-08/09/10; prompts, parser, validators/post-process, details and deep links.
- **Steps:** test prompt-injection text, JSON-shaped instructions, malicious HTML/URLs, oversized nested output and invalid dates/confidence/category; ensure no tool actions arise from email instructions and labels require validated analysis.
- **Acceptance:** unsafe input is bounded/rendered safely; invalid output has no label/action side effect; valid malicious-content mail remains correctly classifiable without following its instructions.
- **Tests/verification:** TEST-004/008 fixtures and deep-link/AI/schema/parser tests; authenticated safe-render browser test.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.

### SEC-006 — Verify mutation authorization, abuse bounds and CSRF posture

- **P1 · EPIC-004 · owner: agent · status: needs verification · dependencies: TEST-003.**
- **Problem/why:** all privileged APIs need consistent auth/ownership/schema/size/rate handling; cookie-authenticated mutations require an explicit cross-site policy review.
- **Evidence/files:** E-05/10/12; all routes under the actual App Router API; OAuth state/callback and cron/internal bearer guards.
- **Steps:** test anonymous, expired, foreign-ID, malformed/oversized payload, duplicate request and cross-site cases for sibling routes; verify return redirects/state/cron secrets without exposing values; close source-backed gaps only.
- **Acceptance:** unauthorized requests cannot cross users or launch privileged operations; malformed bodies return safe bounded errors; legitimate same-origin flows and Google redirects work.
- **Tests/verification:** TEST-003/008 negative API matrix, cron-auth/redirect tests; no destructive live probe.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.

### SEC-007 — Finish source-security coverage and operational threat review

- **P2 · EPIC-004 · owner: agent + project owner · status: partial · dependencies: SEC-001/003/006.**
- **Problem/why:** a planning audit is not proof the entire repository and deployed dependency/configuration surface is secure.
- **Evidence/files:** independent registered source scan; E-01–12/18; operational dashboards unavailable/unexercised.
- **Steps:** retain reviewed surface/file coverage and unresolved leads; finish any deferred paths; validate dependency/branch-policy findings against current source and effective environment; record assumptions and remediate only confirmed findings in separate approved tasks.
- **Acceptance:** explicit coverage, attacker/control evidence for genuine findings, no speculative vulnerability claims; runtime gaps listed; no “secure/no bugs” certification.
- **Tests/verification:** generated security artifacts in the appendix, TEST-001/003/008 and owner-reviewed deployment/configuration checks.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.

### SEC-008 — Bound MIME ingestion and make HTML conversion linear

- **P1 · EPIC-004 · owner: agent · status: open · dependencies: none. Security severity: medium; source confidence: high.**
- **Problem/why:** an external sender's HTML-only message with many script/style/noscript tags repeatedly lowercases the whole HTML inside htmlToText. This is quadratic synchronous CPU/allocation work before later AI context caps, which cannot interrupt the parser.
- **Evidence/files:** E-22; [parser.ts:67](</C:/Users/Daniel/Desktop/Aviv Projects/MailPilot/mailpilot/src/lib/gmail/parser.ts:67>), HTML fallback around 278–282; [messages.ts:58](</C:/Users/Daniel/Desktop/Aviv Projects/MailPilot/mailpilot/src/lib/gmail/messages.ts:58>); E-08 later context truncation. Plain-text MIME and spam/trash filtering reduce some exposure but do not protect included HTML-only mail.
- **Steps:** eliminate repeated whole-input conversion using a linear bounded parser or one bounded lowercase representation; enforce decoded-body/MIME-part/depth/aggregate limits before expensive parsing; preserve safe useful text and explicit truncation semantics.
- **Acceptance:** sender-controlled mail cannot drive disproportionate CPU; limits apply before parsing; ordinary HTML/MIME fixtures remain correct; no new parser dependency unless needed and approved.
- **Tests/verification:** adversarial mixed-case raw-text tags and increasing input-size tests, large/deep MIME limits; `npm test -- src/lib/gmail/parser.test.ts src/lib/gmail/messages.test.ts src/lib/gmail/thread-context.test.ts`; bounded synthetic benchmark and full gates. No malicious mail sent to production.

- **Execution status:** Parser/body, MIME-shape, full-thread and metadata limits implemented with explicit sanitized rejection; direct full-HTML conversion avoids repeated whole-input case folding. Adversarial/ordinary targeted tests PASS 37/37; two metadata tests reproduced a reviewer-confirmed bypass before the fix. Final-source format/lint/typecheck, 588 unit tests, 17 integration simulations, 2 scorecard tests and build PASS. The independent reviewer also confirmed that an unchanged oversized thread can be retried indefinitely as a generic failed thread, keeping later scans PARTIAL. Resolve this via TASK-005's visible non-retryable failure policy without silently classifying truncated text; then recheck the SEC-008 scan-path acceptance. Live Gmail and SDK response materialization remain unverified.

### SEC-009 — Keep abuse budgets and in-flight bounds across cancellation

- **P1 · EPIC-004 · owner: agent + product owner · status: open · dependencies: BUG-007, explicit retry UX decision. Security severity: medium; source confidence: high.**
- **Problem/why:** cancellation frees job/lease state; a cancelled latest run skips the two-minute cooldown. Pending provider requests are not cancelled by that operation, and new scan IDs bypass per-scan runtime deduplication, allowing repeated replacement scans to multiply shared provider/compute work.
- **Evidence/files:** E-22; [manual.ts:61](</C:/Users/Daniel/Desktop/Aviv Projects/MailPilot/mailpilot/src/lib/scans/manual.ts:61>), start check around 146–169, cancel.ts around 74–76, process-scan.ts 583–594, runtime.ts 23–29, provider timeout controllers. Ownership and ordinary admission locks prevent cross-user cancellation but do not repair this abuse path.
- **Steps:** enforce a persistent per-account start budget including cancelled starts; propagate cancellation to expensive requests; maintain account/connection in-flight bounds until admitted work drains; preserve a bounded legitimate retry experience.
- **Acceptance:** repeated owned cancel/start cannot exceed start/concurrency/resource budgets; old provider work is aborted or accounted for; normal recovery remains possible with truthful rate-limit feedback.
- **Tests/verification:** deferred-provider fake-clock start/cancel cycles, concurrent-instance DB admission tests, late AI completion and abort propagation; targeted manual/cancel/runtime/provider tests and TEST-002/007. No live abuse reproduction.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.

### SEC-010 — Enforce thread ownership for direct feedback INSERT

- **P2 · EPIC-004 · owner: agent + Supabase owner · status: open · dependencies: TEST-001, OPS-005 before deployment. Security severity: low; source/live-catalog confidence: high.**
- **Problem/why:** authenticated direct INSERT checks only feedback.user_id; independent foreign keys permit a known foreign thread UUID. The guarded application route checks ownership, but direct PostgREST bypasses that check. Impact is cross-tenant association/existence oracle, not proven email-content read or victim classification change; foreign random UUID knowledge is required.
- **Evidence/files:** E-22; [0004 feedback migration:21](</C:/Users/Daniel/Desktop/Aviv Projects/MailPilot/mailpilot/supabase/migrations/0004_classification_feedback.sql:21>), independent FKs lines 3–8; E-10 route ownership comparison. Live INSERT grant and policy were observed read-only.
- **Steps:** choose guarded server-only INSERT by revoking direct permission, or enforce same-user thread ownership in RLS/constraint; add a new forward migration rather than assume old deployed migration edits apply; preserve valid own-thread feedback.
- **Acceptance:** direct user-A feedback cannot reference user-B thread; own-thread API/DB behavior remains correct as selected; no cross-user oracle via this write path; migration rehearsed safely.
- **Tests/verification:** actual two-user SQL/API test, static policy regression, fresh/incremental schema upgrade; TEST-001/003 and thread queries tests. No unauthorized production INSERT attempted.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.

### TEST-001 — Add real database/RLS and migration tests

- **P1 · EPIC-006 · owner: agent + Supabase owner · status: open · dependencies: approved disposable database access.**
- **Problem/why:** existing RLS suite checks SQL text, not actual queries or schema drift.
- **Evidence/files:** E-11/18/20; all migrations, views/functions and feedback foreign keys.
- **Steps:** build two-user/anonymous/service-role SQL harness in approved test environment; apply migrations to fresh DB; compare catalog/policies/grants/constraints with intended schema; exercise indexes and ownership constraints.
- **Acceptance:** positive and negative SQL assertions pass; fresh-install and deployed-schema drift accounted for; no production data written; migration ledger differences understood.
- **Tests/verification:** new SQL harness command documented only after it exists; current `npm run test:integration` remains supplemental, not proof of RLS.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.

### TEST-002 — Add actual DB lease/checkpoint concurrency tests

- **P1 · EPIC-006 · owner: agent · status: open · dependencies: TEST-001, BUG-001/004/007.**
- **Problem/why:** mock scan tests cannot prove distributed DB admission/fencing or crash persistence.
- **Evidence/files:** E-04/05/11; 0008/0012 migrations and jobs/store.
- **Steps:** test concurrent admissions, heartbeat expiry/takeover, stale finish, resume cursor/counters, interruption and deletion fences against disposable DB.
- **Acceptance:** uniqueness and ownership hold under parallel clients; resumed records equal uninterrupted reference outcomes; no orphan active job.
- **Tests/verification:** explicit disposable-DB test command after harness creation; current targeted scan tests plus integration.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.

### TEST-003 — Add API contract and negative-authorization matrix

- **P1 · EPIC-006 · owner: agent · status: open · dependencies: TEST-001.**
- **Problem/why:** routes need proof of real status/payload/auth behavior, not just helper tests.
- **Evidence/files:** E-05/10/12; scan/latest/cancel/continue, Gmail, settings, action, thread-feedback, digest and privacy routes.
- **Steps:** cover 200/400/401/403/404/409/429/500 as applicable, wrong owner, invalid ID/JSON, missing env/provider, database errors and duplicate mutations; verify trusted server timestamps/counts.
- **Acceptance:** each route has documented safe contract, correct ownership and bounded errors; no backend failure represented as success.
- **Tests/verification:** relevant route tests via existing `npm test -- <paths>` once written; no fabricated `npm run check` or `test:api` script.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.

### TEST-004 — Add provider contracts and real opt-in evaluation

- **P1 · EPIC-006 · owner: agent + project owner · status: partial · dependencies: TASK-001, DEC-003.**
- **Problem/why:** offline provider/schema tests pass; actual model configuration/response/cost behavior remains unverified.
- **Evidence/files:** E-09; current Gemini/NVIDIA implementations/eval fixtures.
- **Steps:** cover success, empty/non-JSON/schema-invalid, semantic contradiction, slow/hung response, abort, 401/429/503 and retry/failover caps; run approved synthetic live corpus separately from offline CI.
- **Acceptance:** offline deterministic contract coverage and reproducible live results kept distinct; correct model/provider selected; no real mailbox content in logs/corpus.
- **Tests/verification:** `npm run eval:scorecard`, targeted AI tests; approved live harness with usage/latency and provider names recorded, not keys.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.

### TEST-005 — Add disposable Gmail integration verification

- **P1 · EPIC-006 · owner: agent + Google/Gmail account owner · status: blocked · dependencies: explicit test Gmail access/consent.**
- **Problem/why:** Gmail ports are mocked; real labels/OAuth/history behavior was not exercised.
- **Evidence/files:** E-07/08; OAuth, token refresh, parser/list/history/labels/recovery.
- **Steps:** seed approved synthetic messages; connect via explicit Gmail consent; verify aliases, pagination/history, changed-only AI, managed-label recovery, 404/deletion, token revoke/reconnect and no unrelated label mutations.
- **Acceptance:** documented live provider behavior on disposable mailbox; no automatic send/delete/archive; real personal inbox not mutated for testing.
- **Tests/verification:** approved contract run and Gmail UI/metadata comparison with scan records; revoke/delete scenarios require owner-controlled authorization.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.

### TEST-006 — Add repeatable authenticated browser/component regressions

- **P1 · EPIC-006 · owner: agent + project owner · status: open · dependencies: BUG-002, TASK-012.**
- **Problem/why:** package has no E2E script and scan card lacks comprehensive component regressions.
- **Evidence/files:** E-03/06/21; existing Testing Library/jsdom dependencies and app flows.
- **Steps:** use existing component tools first; agree browser harness and isolated auth/session fixtures; add E2E dependencies/scripts only when justified and approved; cover onboarding, scan states, buckets/details/actions/settings/session/RTL/accessibility.
- **Acceptance:** reproducible browser suite uses no personal credentials, proves essential happy/failure paths, produces screenshots and does not make real Gmail/paid provider calls in ordinary CI.
- **Tests/verification:** existing `npm test -- <component-paths>` initially; run newly documented E2E script only after it actually exists; manual browser matrix meanwhile.

- **Execution status:** Scan-card/progressbar component subset implemented and independently verified (50/50 tests). Complete authenticated browser journey, viewport and live-session tests remain pending.

### TEST-007 — Add interruption and recovery fault-injection matrix

- **P1 · EPIC-006 · owner: agent · status: open · dependencies: BUG-007, TASK-003/004, TEST-002.**
- **Problem/why:** graceful Promise rejection is not the same as serverless hard termination.
- **Evidence/files:** E-04/05/07; scan worker, lease, persistence and continuation.
- **Steps:** test provider/Gmail hangs, write failure at each boundary, missed self-fetch, process termination, tab close, stale lease, retry exhaustion and new inbound during recovery.
- **Acceptance:** every fault has bounded outcome, accurate durable state, safe retry and no duplicate/missing action/label/message; work can finish without a browser if that SLA was chosen.
- **Tests/verification:** controlled disposable-worker/DB harness plus fake-clock targeted tests; rerun full integration and build.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.

### TEST-008 — Add privacy/security regression suite

- **P1 · EPIC-006 · owner: agent · status: partial · dependencies: TEST-001/003, SEC-002/003/005/006.**
- **Problem/why:** encryption/redaction/static RLS tests exist, but lifecycle and attacker-boundary guarantees need repeatable proof.
- **Evidence/files:** E-11/12 and generated source-security review.
- **Steps:** test foreign IDs/direct DB access, OAuth state/redirects, cron/internal bearer guards, built client secrets, log redaction, prompt injection, cancellation/deletion and key rotation.
- **Acceptance:** a deliberately regressed control fails a targeted test; no live secrets/PII or destructive probes; approved security fixes cannot silently regress.
- **Tests/verification:** targeted encryption/env/redirect/cron/privacy tests; real RLS/API harness plus disposable deletion verification.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.

### TEST-009 — Record exact-SHA deployment smoke and live readiness

- **P1 · EPIC-006 · owner: agent + project owner · status: blocked · dependencies: OPS-001/002/003/005/006, core P1 gates.**
- **Problem/why:** public availability and job SUCCESS do not establish a working product release.
- **Evidence/files:** E-16–21; approved preview/production deployment and synthetic mailbox.
- **Steps:** record commit/dirty state/environment/provider/database target; run all seven local gates; verify deployed identity/Gmail separation, successful analysis/labels/buckets, closed-tab recovery, cron execution and alert delivery; document rollback trigger.
- **Acceptance:** intended SHA is READY; representative scan has successful analyses and reconciled counts; no unexplained all-failure PARTIAL; owner confirms allowed live tests; runtime checks and rollback evidence recorded.
- **Tests/verification:** Section 6 commands plus approved deployed smoke checklist, not an invented E2E command.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.

### DOC-001 — Resolve contradictory agent layout guidance

- **P1 · EPIC-007 · owner: project owner then agent · status: blocked · dependencies: DEC-001.**
- **Problem/why:** supplied `client/`/`server/` instructions do not match actual Next.js `src/` and `supabase/`; blindly obeying both breaks architecture.
- **Evidence/files:** E-01/02/03; outer Cursor settings and nested AGENTS/source folders.
- **Steps:** agree authoritative layout; update scoped instructions and exact cwd/check commands; clarify browser/server boundaries by module role, not imaginary paths.
- **Acceptance:** one consistent instruction set; commands resolve from the nested Git root; no layout move included in a documentation fix.
- **Tests/verification:** instruction/source comparison, link/script validation and `npm run format:check`.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.

### DOC-002 — Reconcile scan timing, modes, provider and completion semantics

- **P2 · EPIC-007 · owner: agent + project owner · status: open · dependencies: EDGE-006, DEC-002/003/006.**
- **Problem/why:** docs mention 240s work while dirty code uses 210s; manual selected-lookback and scheduled incremental behavior, provider selection and partial retries must be accurately described.
- **Evidence/files:** E-01/02/04/05/09; README/decisions/spec/owner guide.
- **Steps:** document current versus intended runtime, leases/stale windows, manual two-minute rate limit, forced lookback vs incremental, completed/checked/analyzed/failed definitions and real failover/retry state.
- **Acceptance:** no blanket “subsequent scans only changes” contradiction with manual lookback; no promised queued retry/runtime fallback unless implemented; superseded spec text clearly marked.
- **Tests/verification:** docs-to-code/constants comparison plus format/link checks; no product behavior silently changed to fit old prose.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.

### DOC-003 — Maintain owner/deployment/privacy runbooks

- **P2 · EPIC-007 · owner: agent + project owner · status: partial · dependencies: OPS-002/003/005/006, SEC-002, DEC-005.**
- **Problem/why:** owner checklist has unchecked items; unchecked does not mean absent, and known-good recovery must be repeatable.
- **Evidence/files:** E-01/12/16–20; HUMAN_TASKS, Supabase README and public policy/terms source.
- **Steps:** mark each owner task verified/incomplete/blocked with date/proof; describe OAuth identity vs Gmail, provider destinations/retention, migration/deploy/rollback and redacted stuck/partial-scan diagnosis; leave custom SMTP optional for internal launch.
- **Acceptance:** no outdated live-working claim, secret value or unauthorized legal promise; actual remaining owner console steps identifiable.
- **Tests/verification:** owner dashboard walk-through; policy/terms tests; format/link review. Public legal correctness requires owner/legal review, not code-test certification.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.

### DOC-004 — Reconcile rename, license and old task artifacts

- **P3 · EPIC-007 · owner: agent + project owner · status: open · dependencies: DEC-005.**
- **Problem/why:** external Vercel names remain gmailpilot; no license selected; old task files are not present in current tree.
- **Evidence/files:** E-01/13/15/16 and historical chats.
- **Steps:** inventory remaining old names in code/docs/GitHub/Vercel/Google/Supabase/Sentry/Cursor/worktrees; decide whether harmless IDs/aliases should stay; map old backlog once to this plan; select license before public distribution if applicable.
- **Acceptance:** no broken OAuth redirects/domains from cosmetic renaming; no invented missing artifact; no branch/worktree cleanup without scope/approval.
- **Tests/verification:** source search plus external read-only inventory, OAuth/deployment smoke after any separately approved rename; formatting.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.

### TASK-015 — Make only justified repository organization changes

- **P3 · EPIC-007 · owner: agent + project owner · status: blocked · dependencies: DEC-001, stable core P1 work.**
- **Problem/why:** cleanup should remove real confusion, not impose a new monorepo or move migrations into browser code.
- **Evidence/files:** Section 5, E-01/03/13/14.
- **Steps:** verify outer lockfile/_stash/duplicate instruction consumers; propose minimal isolated move/remove with recovery plan only if unused; keep current module architecture by default; preserve all existing work.
- **Acceptance:** owner-approved proposals list every affected import/script/config; no orphan artifacts or source loss; all checks pass after each actual change.
- **Tests/verification:** Section 5 move-specific checks, full format/lint/typecheck/test/build. No move performed by this audit.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.

### OPS-001 — Explain and repair the current preview ERROR

- **P1 · EPIC-008 · owner: agent + Vercel owner · status: blocked · dependencies: accessible build logs, BUG-001.**
- **Problem/why:** preview at committed HEAD is ERROR although the dirty local build passes; exact cause was inaccessible.
- **Evidence/files:** E-14/16/17; preview dpl_HTVU52WuGKxmAZ8cHTcneH9sQPZX; source/env/build settings.
- **Steps:** obtain redacted build error, exact SHA and env/root/Node/install configuration; reproduce against isolated exact commit without discarding dirty work; fix the minimal cause; verify approved preview.
- **Acceptance:** causal build error understood; intended revision READY with required checks, not just local success; no secret/env dump.
- **Tests/verification:** all seven gates on agreed revision and Vercel deployment metadata/build logs. Deployment needs a later explicit request.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.

### OPS-002 — Verify environment and Google OAuth configuration

- **P1 · EPIC-008 · owner: Vercel/Supabase/Google dashboard owner + agent · status: needs verification · dependencies: approved console access.**
- **Problem/why:** provider/env/OAuth correctness cannot be inferred from local schema tests; production may share a project called dev.
- **Evidence/files:** E-01/07/09/12/16/18; env names, redirect URLs, OAuth scopes/test users and Supabase provider settings.
- **Steps:** compare required variable names and environment scopes without values; verify actual root directory/Node/public URLs, server-only keys, Google identity callback and separate Gmail callback/scopes; identify preview vs production database separation and consent test-user/verification limits.
- **Acceptance:** every required value has an owner/validated presence and proper scope; no service key in browser; identity login asks no Gmail scope; approved consent returns to correct environment.
- **Tests/verification:** dashboard metadata plus TEST-006/009 disposable identity/Gmail journeys. Do not create credentials, broaden consent or change access without specific approval.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.

### OPS-003 — Resolve daily scheduler timing/throughput and recovery SLA

- **P1 · EPIC-008 · owner: project owner then agent · status: blocked · dependencies: DEC-002.**
- **Problem/why:** one connection per dispatcher invocation plus daily cron may leave multi-user backlog; 06:00 UTC differs from 08:00 Asia/Jerusalem across DST. Fallback due in five minutes is not a five-minute wakeup.
- **Evidence/files:** E-05/16 and [vercel.json](</C:/Users/Daniel/Desktop/Aviv Projects/MailPilot/mailpilot/vercel.json>), schedule.ts. The configured expression is `0 6 * * *`; daily-only/per-hour precision is a [current Hobby limitation](https://vercel.com/docs/cron-jobs/usage-and-pricing).
- **Steps:** verify actual deployed plan/cron; quantify overdue connections and continuation behavior; decide acceptable schedule window/throughput; test DST/user timezone and fairness; implement only approved infrastructure or document limitations honestly.
- **Acceptance:** selected no-cost/cost-approved SLA met; each due user eventually scanned without starvation; no unsupported hourly Hobby cron; displayed time/late-run behavior truthful.
- **Tests/verification:** schedule/dispatcher/cron tests, TEST-002/007/009; read deployed cron history and safe aggregate queue metadata, not mailbox contents.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.

### OPS-004 — Reconcile PRs, automated approvals and dependency updates

- **P2 · EPIC-007 · owner: GitHub/project owner + agent · status: open · dependencies: BUG-001, target-branch decision.**
- **Problem/why:** open provider/cloud PRs may overlap main; historical automation merged despite conflicting checkpoint review; Dependabot request remains.
- **Evidence/files:** E-03/13/15; CI/dependency-review workflow and branch settings.
- **Steps:** compare PR 84/86 to current main and working changes; retain only needed diff; verify effective required checks/approvals and unresolved findings; propose grouped patch/minor updates plus reasonable PR cap and separate major/security policy.
- **Acceptance:** no duplicate merge or auto-merge with unresolved blockers; dependency updates remain reviewed/tested; draft environment PR only accepted if still useful.
- **Tests/verification:** live PR/check/rule metadata plus all existing gates for each selected update. Do not merge/close/edit PRs or branch rules during this audit.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.

### OPS-005 — Rehearse migrations, schema drift and rollback safely

- **P1 · EPIC-008 · owner: agent + Supabase owner · status: open · dependencies: TEST-001, approved disposable environment.**
- **Problem/why:** 12 numbered local migrations and six timestamp ledger rows require catalog reconciliation; destructive rollback must not be guessed.
- **Evidence/files:** E-11/18/20; migrations 0001–0012 and actual live catalog.
- **Steps:** apply fresh-install and incremental upgrades in test DB; compare constraints/indexes/RLS/views/functions; define backup/recovery and forward-fix strategy; rehearse compatible old/new app deployment ordering and interrupted migration.
- **Acceptance:** reproducible fresh schema and upgrade, no missing required objects or unsafe grants; rollback/recovery documented and tested without production reset/data loss.
- **Tests/verification:** TEST-001 real catalog/SQL assertions and test-environment recovery rehearsal. No production migration/rollback performed without explicit approval.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.

### OPS-006 — Prove monitoring and redacted failure alert delivery

- **P1 · EPIC-008 · owner: agent + Sentry/Vercel/project owner · status: needs verification · dependencies: TASK-005, SEC-003.**
- **Problem/why:** source logging/redaction exists; latest all-failure scans and stale leases need timely actionable alerts, but dashboard delivery was not proved.
- **Evidence/files:** E-12/17/19; Sentry configuration, product events and release/environment tagging.
- **Steps:** test synthetic all-failure, stalled lease, cron missed/late, continuation failure and repeated quota errors; configure approved alert routing; verify ingestion/redaction/retention and dashboard access limits; distinguish expected PARTIAL from zero-success outage.
- **Acceptance:** one actionable alert per incident with safe IDs/stages and runbook; no sensitive data or unchanged-state spam; owner receives test alert and can diagnose within recorded access limits.
- **Tests/verification:** targeted privacy/events tests and owner-approved synthetic alert; inspect actual Sentry/Vercel event at intended SHA. No paid monitoring upgrade inferred.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.

### OPS-007 — Review database performance warnings and upgrade advisory

- **P2 · EPIC-008 · owner: agent + Supabase owner · status: open · dependencies: TEST-001/002, OPS-005.**
- **Problem/why:** advisor reports four missing FK indexes and 18 per-row auth initplan warnings; Postgres 17.6 should be checked against provider security updates.
- **Evidence/files:** E-18/20; feedback/messages/scan_jobs/scan_runs foreign keys and policies. [Supabase changelog](https://supabase.com/changelog) was consulted for current upgrade guidance; no upgrade executed.
- **Steps:** measure representative queries with safe EXPLAIN/test data; add justified indexes and initplan-compatible policies; check current provider upgrade/extension advisory and rehearse if needed; keep unused due_scan_idx unless sustained evidence proves unnecessary.
- **Acceptance:** measured improvement without weakened RLS or duplicate indexes; upgrade decision documented with recovery/cost/downtime; no “unused” index removed from a single snapshot alone.
- **Tests/verification:** TEST-001/002, plan comparison, re-run advisors and disposable migration/build gates.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.

### OPS-008 — Produce release go/no-go and rollback handoff

- **P1 · EPIC-008 · owner: agent + project owner · status: blocked · dependencies: TEST-009, unresolved P1/security decisions closed.**
- **Problem/why:** source edits, committed code, PR status, READY deployment and live-working outcome are distinct milestones.
- **Evidence/files:** all release-gate evidence; current main/preview/dirty working tree.
- **Steps:** select exact revision, review diff/checks/known limitations, get deployment authorization, release through existing workflow, verify live smoke/cron/alerts, record rollback target and incident triggers.
- **Acceptance:** owner-signed go/no-go names exact SHA/environment; no all-failure analysis or unknown preview failure; report explicitly states reviewed/changed/committed/PR/deployed/live-verified outcomes.
- **Tests/verification:** Section 6 seven gates, TEST-009 and owner deployment/rollback checklist. This task is a plan, not authorization to ship.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.

### DEC-001 — Authoritative repository layout and instruction hierarchy

- **P1 · EPIC-001 · owner: project owner · status: open · dependencies: none.**
- **Outcome/why:** resolve client/server versus actual src/supabase conflict without accidental restructure. E-01/03/13; recommended default: retain current architecture and update inconsistent instructions.
- **Steps:** approve authoritative boundaries and nested cwd; decide whether a separate restructure is genuinely needed; record impact in DOC-001/Section 5.
- **Acceptance/tests/verification:** one documented decision, no conflicting commands/locations; docs/source inspection and format check. A major move is a separate approved project, not bundled here.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.

### DEC-002 — Scheduling, continuation and retry service level

- **P1 · EPIC-001 · owner: project owner · status: open · dependencies: E-05/16/19 evidence.**
- **Outcome/why:** choose daily approximate no-cost schedule/recovery limitations versus explicitly approved alternative infrastructure/cost; affects TASK-004/005 and OPS-003.
- **Steps:** set maximum scan/recovery latency, retry count and multi-user backlog promise; confirm actual plan; approve any external service separately.
- **Acceptance/tests/verification:** measurable SLA and infrastructure constraints recorded; fake-clock/DST/multi-user/closed-tab tests named before implementation.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.

### DEC-003 — Provider order, failover and data destination consent

- **P2 · EPIC-001 · owner: project owner · status: open · dependencies: TASK-001.**
- **Outcome/why:** select current NVIDIA-first configuration, Gemini-first, or approved runtime failover; do not change product/privacy behavior silently. E-09 and provider chat.
- **Steps:** verify current model availability/usage terms with primary provider docs before choosing; define allowed credentials/destinations/budget; decide local/Docker separately only if justified by hardware and latency.
- **Acceptance/tests/verification:** explicit provider/deadline/retry/cost/data-consent policy; TEST-004 contracts and source/runtime selection agree. No unsupported “free forever” guarantee or quota evasion.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.

### DEC-004 — Selected circular progress design and UX acceptance

- **P2 · EPIC-001 · owner: project owner · status: open · dependencies: none.**
- **Outcome/why:** recover the user's “option 2 with the circle” reference; existing bar does not establish which circular visual was intended. E-06 and ScanProb/UX chats.
- **Steps:** supply/approve reference and truthful stage/count/cancellation requirements; agree mobile and reduced-motion behavior.
- **Acceptance/tests/verification:** approved screenshot/spec and TASK-013/014 acceptance matrix; no guessed visual treated as approved.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.

### DEC-005 — Launch scope, identity/branding, license and dashboard options

- **P2 · EPIC-001 · owner: project owner · status: open · dependencies: none.**
- **Outcome/why:** internal test release vs public launch changes consent, legal/license, Auth and monitoring requirements. E-01/15–20.
- **Steps:** decide external rename/custom domain, license, public OAuth verification/SMTP needs and password-protection eligibility/cost; identify production/test project separation.
- **Acceptance/tests/verification:** owner checklist reflects chosen scope; no unnecessary SMTP/domain/paid upgrade blocks internal testing; OAuth redirects and docs remain correct.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.

### DEC-006 — Manual lookback, external Gmail changes and non-MVP boundaries

- **P2 · EPIC-001 · owner: project owner · status: open · dependencies: E-01/02/08.**
- **Outcome/why:** clarify manual re-scan scope, Trash/deletion/label-only sync and unsupported attachments without extending the MVP implicitly.
- **Steps:** confirm chosen manual lookback vs scheduled incremental; decide supported external-state sync and retention; keep email digest delivery, automatic replies/sending, attachment analysis, calendar sync and push subscriptions out of scope unless separately approved.
- **Acceptance/tests/verification:** one behavior table overrides stale spec passages; EDGE-009/DOC-002/TEST-005 cover chosen semantics; no unapproved feature task added.

- **Execution status:** Not started. Retain the original steps, affected systems, acceptance, verification, dependencies and risks above.
