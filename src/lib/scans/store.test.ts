import { beforeEach, describe, expect, it, vi } from "vitest";

type SettingsRow = {
  user_id: string;
  initial_lookback_days: number;
  daily_scan_time: string;
  timezone: string;
  scan_interval_minutes: number | null;
  vip_senders: string[];
  ignored_senders: string[];
  ignored_domains: string[];
  custom_ai_instructions: string;
};

const mockState = vi.hoisted(() => ({
  settings: new Map<string, SettingsRow>(),
}));

function createBuilder(table: string) {
  let op = "select" as "select" | "insert" | "upsert";
  const filters: Array<{ column: string; value: string }> = [];
  let insertPayload: Partial<SettingsRow> | null = null;
  let selectColumns = "*";

  const execute = () => {
    if (table !== "user_triage_settings") {
      return { data: null, error: { message: "unknown table" } };
    }

    if (op === "insert") {
      const userId = insertPayload?.user_id;
      if (!userId) {
        return { data: null, error: { message: "missing user_id" } };
      }
      if (mockState.settings.has(userId)) {
        return { data: null, error: { message: "duplicate key", code: "23505" } };
      }
      const row: SettingsRow = {
        user_id: userId,
        initial_lookback_days: insertPayload?.initial_lookback_days ?? 7,
        daily_scan_time: insertPayload?.daily_scan_time ?? "08:00",
        timezone: insertPayload?.timezone ?? "Asia/Jerusalem",
        scan_interval_minutes: insertPayload?.scan_interval_minutes ?? null,
        vip_senders: [],
        ignored_senders: [],
        ignored_domains: [],
        custom_ai_instructions: "",
      };
      mockState.settings.set(userId, row);
      return { data: pickColumns(row, selectColumns), error: null };
    }

    const userId = filters.find((filter) => filter.column === "user_id")?.value;
    const row = userId ? mockState.settings.get(userId) : undefined;
    if (!row) {
      return { data: null, error: null };
    }
    return { data: pickColumns(row, selectColumns), error: null };
  };

  const builder = {
    select(columns: string) {
      selectColumns = columns;
      return builder;
    },
    eq(column: string, value: string) {
      filters.push({ column, value });
      return builder;
    },
    insert(payload: Partial<SettingsRow>) {
      op = "insert";
      insertPayload = payload;
      return builder;
    },
    upsert(payload: Partial<SettingsRow>) {
      op = "upsert";
      insertPayload = payload;
      const userId = payload.user_id;
      if (userId) {
        const existing = mockState.settings.get(userId);
        mockState.settings.set(userId, {
          user_id: userId,
          initial_lookback_days: payload.initial_lookback_days ?? 7,
          daily_scan_time: payload.daily_scan_time ?? "08:00",
          timezone: payload.timezone ?? "Asia/Jerusalem",
          scan_interval_minutes: payload.scan_interval_minutes ?? null,
          vip_senders: existing?.vip_senders ?? [],
          ignored_senders: existing?.ignored_senders ?? [],
          ignored_domains: existing?.ignored_domains ?? [],
          custom_ai_instructions: existing?.custom_ai_instructions ?? "",
        });
      }
      return builder;
    },
    single: () => execute(),
    maybeSingle: () => execute(),
    then(
      onFulfilled: (value: { data: unknown; error: unknown }) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) {
      return Promise.resolve(execute()).then(onFulfilled, onRejected);
    },
  };
  return builder;
}

function pickColumns(row: SettingsRow, columns: string): Record<string, unknown> {
  if (columns === "*") {
    return row;
  }
  const picked: Record<string, unknown> = {};
  for (const column of columns.split(",").map((item) => item.trim())) {
    if (column in row) {
      picked[column] = row[column as keyof SettingsRow];
    }
  }
  return picked;
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => createBuilder(table),
  }),
}));

describe("createSupabaseScanStore getSettings", () => {
  beforeEach(() => {
    mockState.settings.clear();
  });

  it("preserves saved timezone and daily scan time instead of resetting defaults", async () => {
    mockState.settings.set("user-1", {
      user_id: "user-1",
      initial_lookback_days: 14,
      daily_scan_time: "09:30",
      timezone: "America/New_York",
      scan_interval_minutes: null,
      vip_senders: ["vip@example.com"],
      ignored_senders: [],
      ignored_domains: [],
      custom_ai_instructions: "Prefer finance mail.",
    });

    const { createSupabaseScanStore } = await import("@/lib/scans/store");
    const settings = await createSupabaseScanStore().getSettings("user-1");

    expect(settings.timezone).toBe("America/New_York");
    expect(settings.dailyScanTime).toBe("09:30");
    expect(settings.vipSenders).toEqual(["vip@example.com"]);
    expect(mockState.settings.get("user-1")).toMatchObject({
      timezone: "America/New_York",
      daily_scan_time: "09:30",
      initial_lookback_days: 14,
    });
  });

  it("inserts defaults when settings are missing", async () => {
    const { createSupabaseScanStore } = await import("@/lib/scans/store");
    const settings = await createSupabaseScanStore().getSettings("user-new");

    expect(settings.timezone).toBe("Asia/Jerusalem");
    expect(settings.dailyScanTime).toBe("08:00");
    expect(mockState.settings.has("user-new")).toBe(true);
  });
});
