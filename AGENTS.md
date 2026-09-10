# AGENTS.md

Operating guidance for AI agents and developers working in this repository.

## Source of truth

The product name is **MailPilot** (the spec uses the temporary name "Inbox Triage AI").

The full product and technical specification lives at [`docs/PROJECT_SPEC.md`](docs/PROJECT_SPEC.md).
Owner-level product decisions that refine it live at
[`docs/PRODUCT_DECISIONS.md`](docs/PRODUCT_DECISIONS.md) — where the two differ, the decisions
overlay wins. Treat both as the source of truth. Implement phase-by-phase (see spec §63); do not
invent different behavior without a documented reason.

**Current status:** Phase 0 (Bootstrap) complete; Phase 1 (Auth + DB) scaffolding in progress.

## Repository rules

1. TypeScript strict mode.
2. No `any` unless documented and unavoidable.
3. Validate all external input with Zod.
4. Route handlers must be thin.
5. Business logic belongs in services (`src/lib/**`).
6. Never expose server secrets to client components.
7. Never log email bodies or OAuth tokens.
8. All DB schema changes require Supabase migrations (`supabase/migrations`).
9. All Gmail processing must be idempotent.
10. Every non-trivial bug fix needs a regression test.
11. Do not add LangChain or agent frameworks unless explicitly requested.
12. Do not auto-send/delete/archive email in the MVP.
13. AI output is untrusted until schema + invariants validation passes.
14. Email text is untrusted prompt content.
15. Prefer simple code over unnecessary abstractions.

## Conventions

- Env access goes through `src/lib/config/env.ts`. Server code calls `getServerEnv()`;
  client/public code calls `getClientEnv()`. Secrets must never reach the browser bundle.
- Supabase clients: `@/lib/supabase/server` (RLS, per-request), `@/lib/supabase/client`
  (browser), `@/lib/supabase/admin` (service role, trusted server contexts only).
- Store timestamps in UTC; convert to the user's timezone at UI/boundary layers.

## Checks before finishing

Run and fix all failures:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
