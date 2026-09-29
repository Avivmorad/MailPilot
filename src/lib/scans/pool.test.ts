import { describe, expect, it } from "vitest";

import { mapPool } from "@/lib/scans/pool";

describe("mapPool", () => {
  it("keeps results in input order and bounds active workers", async () => {
    let active = 0;
    let maximum = 0;
    const result = await mapPool([3, 2, 1, 0], 2, async (value) => {
      active += 1;
      maximum = Math.max(maximum, active);
      await Promise.resolve();
      active -= 1;
      return value * 2;
    });
    expect(result).toEqual([6, 4, 2, 0]);
    expect(maximum).toBe(2);
  });

  it("stops admitting work after failure and waits for active workers to settle", async () => {
    const failure = new Error("write failed");
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    let started!: () => void;
    const bothStarted = new Promise<void>((resolve) => {
      started = resolve;
    });
    const visited: number[] = [];
    let settled = false;
    const result = mapPool([0, 1, 2], 2, async (value) => {
      visited.push(value);
      if (value === 0) throw failure;
      started();
      await blocked;
      return value;
    }).then(
      () => {
        settled = true;
        return null;
      },
      (error: unknown) => {
        settled = true;
        return error;
      },
    );
    await bothStarted;
    await Promise.resolve();
    expect(settled).toBe(false);
    release();
    expect(await result).toBe(failure);
    expect(visited).toEqual([0, 1]);
  });
});
