# Test fixtures

Synthetic email fixtures for triage evaluation. **No real personal data.**

- `email-triage.json` — catalog of single-message cases used by the eval harness.
- `email-triage.csv` — the same catalog in spreadsheet form for human review.
- `../evals/email-triage.json` — additional thread-shaped cases (prompt injection,
  paid vs unpaid, OTP vs security, career receipts vs assessments, OOO/waiting,
  meeting changes, delivery vs customs, relative dates, long/forwarded threads,
  automated actions, Hebrew/mixed language).

Columns / fields in the catalog: `subject`, `sender_type`, `email_body`,
`expected_importance` (`high` | `medium` | `low`), `expected_action`
(`reply` | `pay` | `review` | `approve` | `submit` | `schedule` | `sign` | `none`),
and `expected_summary` (in English, per `docs/PRODUCT_DECISIONS.md`).

The combined harness in `src/lib/ai/eval-fixtures.ts` loads both JSON files and
requires schema-valid gold analyses. Deadlines are `null` unless the thread
contains an explicit `YYYY-MM-DD` date — fixtures must not invent dates.

`src/lib/ai/eval-scorecard.ts` scores a confused-model baseline after
post-processing. Curated MVP gates: schema validity 100%, action recall ≥ 90%,
deadline hallucination 0. Run `npm run eval:scorecard`.
