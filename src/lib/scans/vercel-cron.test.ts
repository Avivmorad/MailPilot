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
    expect(dispatcher).toMatch(/export const maxDuration = 300;/);
    expect(scans).toMatch(/export const maxDuration = 300;/);
    expect(scans).not.toMatch(/maxDuration = 800/);
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
