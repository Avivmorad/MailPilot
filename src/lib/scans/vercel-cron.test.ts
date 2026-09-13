import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("vercel.json crons", () => {
  it("uses a Hobby-safe once-per-day schedule", () => {
    const raw = readFileSync(path.join(process.cwd(), "vercel.json"), "utf8");
    const config = JSON.parse(raw) as { crons?: Array<{ path?: string; schedule?: string }> };
    expect(config.crons).toHaveLength(1);
    const cron = config.crons?.[0];
    expect(cron?.path).toBe("/api/cron/scan-dispatcher");
    const parts = cron?.schedule?.split(" ") ?? [];
    expect(parts).toHaveLength(5);
    expect(parts[0]).toMatch(/^\d+$/);
    expect(parts[1]).toMatch(/^\d+$/);
    expect(parts[2]).toBe("*");
    expect(parts[3]).toBe("*");
    expect(parts[4]).toBe("*");
  });

  it("caps the scan dispatcher at the Hobby maxDuration", () => {
    const dispatcher = readFileSync(
      path.join(process.cwd(), "src/app/api/cron/scan-dispatcher/route.ts"),
      "utf8",
    );
    const scans = readFileSync(path.join(process.cwd(), "src/app/api/scans/route.ts"), "utf8");
    const cont = readFileSync(
      path.join(process.cwd(), "src/app/api/scans/continue/route.ts"),
      "utf8",
    );
    expect(dispatcher).toMatch(/export const maxDuration = 300;/);
    expect(scans).toMatch(/export const maxDuration = 300;/);
    expect(cont).toMatch(/export const maxDuration = 300;/);
    expect(scans).not.toMatch(/maxDuration = 800/);
  });

  it("claims only due CONNECTED Gmail accounts", () => {
    const sql = readFileSync(
      path.join(process.cwd(), "supabase/migrations/0007_scan_scheduling.sql"),
      "utf8",
    );
    const leases = readFileSync(path.join(process.cwd(), "src/lib/scans/leases.ts"), "utf8");
    expect(sql).toContain("c.status = 'CONNECTED'");
    expect(sql).toContain("c.next_scan_at <= now()");
    expect(sql).toContain("for update skip locked");
    expect(leases).toContain('.eq("status", "CONNECTED")');
    expect(leases).toContain('.lte("next_scan_at", nowIso)');
  });
});

describe("scan-dispatcher maxDuration", () => {
  it("stays within the Vercel Hobby Serverless Function range (1–300)", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/app/api/cron/scan-dispatcher/route.ts"),
      "utf8",
    );
    const match = source.match(/export const maxDuration = (\d+);/);
    expect(match).not.toBeNull();
    const maxDuration = Number(match?.[1]);
    expect(maxDuration).toBeGreaterThanOrEqual(1);
    expect(maxDuration).toBeLessThanOrEqual(300);
  });
});

describe("manual scan route maxDuration", () => {
  it("stays within the Vercel Hobby Serverless Function range (1–300)", () => {
    const source = readFileSync(path.join(process.cwd(), "src/app/api/scans/route.ts"), "utf8");
    const match = source.match(/export const maxDuration = (\d+);/);
    expect(match).not.toBeNull();
    const maxDuration = Number(match?.[1]);
    expect(maxDuration).toBeGreaterThanOrEqual(1);
    expect(maxDuration).toBeLessThanOrEqual(300);
  });
});
