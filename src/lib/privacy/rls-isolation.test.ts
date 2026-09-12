import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("RLS isolation", () => {
  it("scopes product tables to auth.uid() so user A cannot read user B", () => {
    const migrationsDir = path.join(process.cwd(), "supabase/migrations");
    const sql = [
      "0002_gmail_connections.sql",
      "0003_initial_scan.sql",
      "0004_classification_feedback.sql",
      "0006_digest_reports.sql",
      "0007_scan_scheduling.sql",
    ]
      .map((name) => readFileSync(path.join(migrationsDir, name), "utf8"))
      .join("\n");

    const required = [
      "gmail_connections_select_own",
      "email_threads_select_own",
      "email_messages_select_own",
      "action_items_select_own",
      "scan_runs_select_own",
      "digest_reports_select_own",
      "classification_feedback_select_own",
      "scan_jobs_select_own",
    ];
    for (const policy of required) {
      expect(sql, policy).toContain(`create policy "${policy}"`);
    }
    expect(sql).toMatch(/auth\.uid\(\)\s*=\s*user_id/);
    expect(sql).not.toMatch(/using\s*\(\s*true\s*\)/);
  });
});
