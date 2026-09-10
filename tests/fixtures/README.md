# Test fixtures

Synthetic email fixtures for triage evaluation. **No real personal data.**

- `email-triage.json` — machine-readable fixtures used by the eval harness (added in Phase 4).
- `email-triage.csv` — the same cases in spreadsheet form for human review.

Columns / fields: `subject`, `sender_type`, `email_body`, `expected_importance`
(`high` | `medium` | `low`), `expected_action`
(`reply` | `pay` | `review` | `approve` | `submit` | `schedule` | `sign` | `none`), and
`expected_summary` (in Hebrew, per `docs/PRODUCT_DECISIONS.md`).

Coverage includes: reply-by-tomorrow, invoice to pay, payment confirmation, newsletter,
promotion, meeting reschedule, security alert vs. routine login, school registration, important
work approval, already-replied (waiting) thread, attachment for review, overdue deadline,
shipping, password reset, job interview, bank statement, subscription renewal, calendar invite,
phishing, colleague question, travel itinerary, signature request, social notification, FYI
forward, and failed payment.

These will grow to the ~50-case set described in `docs/PROJECT_SPEC.md` §48 as the AI phase lands.
