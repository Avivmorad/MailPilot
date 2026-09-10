# Supabase

Database schema and migrations for MailPilot.

- `migrations/` — SQL migrations, committed to the repository. Added from Phase 1 onward.
- Row Level Security is required on every user-accessible table (`user_id = auth.uid()`).

See [`../docs/PROJECT_SPEC.md`](../docs/PROJECT_SPEC.md) §16–18 for the schema, RLS, and
encryption requirements.
