# Supabase

Database schema and migrations for MailPilot.

- `migrations/` — SQL migrations, committed to the repository. Added from Phase 1 onward.
  - `0001_profiles.sql` — app profiles.
  - `0002_gmail_connections.sql` — Gmail OAuth connections and MailPilot labels.
  - `0003_initial_scan.sql` — triage settings, threads, messages (no bodies),
    action items, and scan runs.
  - `0004_classification_feedback.sql` — thread classification feedback.
  - `0005_scan_progress.sql` — live scan progress (`threads_discovered` / `threads_checked`).
- Row Level Security is required on every user-accessible table (`user_id = auth.uid()`).
  Scan writes use the service role.

See [`../docs/PROJECT_SPEC.md`](../docs/PROJECT_SPEC.md) §16–18 for the schema, RLS, and
encryption requirements.
