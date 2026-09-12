# Supabase

Database schema and migrations for MailPilot.

- `migrations/` — SQL migrations, committed to the repository. Added from Phase 1 onward.
  - `0001_profiles.sql` — app profiles.
  - `0002_gmail_connections.sql` — Gmail OAuth connections and MailPilot labels.
  - `0003_initial_scan.sql` — triage settings, threads, messages (no bodies),
    action items, and scan runs.
  - `0004_classification_feedback.sql` — thread classification feedback.
  - `0005_scan_progress.sql` — live scan progress (`threads_discovered` / `threads_checked`).
  - `0006_digest_reports.sql` — in-app digest snapshots (not email).
  - `0007_scan_scheduling.sql` — connection leases, `scan_jobs`, dispatcher claim.
  - `0008_scan_admission.sql` — at most one RUNNING `scan_runs` row per connection.
- Row Level Security is required on every user-accessible table (`user_id = auth.uid()`).
  Scan writes use the service role.

See [`../docs/PROJECT_SPEC.md`](../docs/PROJECT_SPEC.md) §16–18 for the schema, RLS, and
encryption requirements.
