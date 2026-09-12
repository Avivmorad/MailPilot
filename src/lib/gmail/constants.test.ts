import { describe, expect, it } from "vitest";

import {
  GMAILPILOT_LABELS,
  resolveExistingManagedLabel,
} from "@/lib/gmail/constants";

describe("GMAILPILOT_LABELS", () => {
  it("uses the product GmailPilot/ namespace", () => {
    const names = GMAILPILOT_LABELS.map((label) => label.gmailLabelName);
    expect(names).toEqual([
      "GmailPilot/Important",
      "GmailPilot/Action Required",
      "GmailPilot/Low Priority",
      "GmailPilot/Processed",
    ]);
  });

  it("keeps MailPilot/ names as legacy aliases", () => {
    const legacy = GMAILPILOT_LABELS.flatMap((label) => [...label.legacyGmailLabelNames]);
    expect(legacy).toEqual([
      "MailPilot/Important",
      "MailPilot/Action Required",
      "MailPilot/Low Priority",
      "MailPilot/Processed",
    ]);
  });

  it("has unique logical names", () => {
    const logical = GMAILPILOT_LABELS.map((label) => label.logicalName);
    expect(new Set(logical).size).toBe(logical.length);
  });
});

describe("resolveExistingManagedLabel", () => {
  const important = GMAILPILOT_LABELS.find((spec) => spec.logicalName === "important");
  if (!important) {
    throw new Error("expected important label spec");
  }

  it("prefers the current GmailPilot/ name when both exist", () => {
    const byName = new Map([
      ["MailPilot/Important", "legacy-id"],
      ["GmailPilot/Important", "current-id"],
    ]);
    expect(resolveExistingManagedLabel(byName, important)).toEqual({
      id: "current-id",
      name: "GmailPilot/Important",
    });
  });

  it("reuses an existing MailPilot/ label instead of missing", () => {
    const byName = new Map([["MailPilot/Important", "legacy-id"]]);
    expect(resolveExistingManagedLabel(byName, important)).toEqual({
      id: "legacy-id",
      name: "MailPilot/Important",
    });
  });

  it("returns null when neither current nor legacy name exists", () => {
    expect(resolveExistingManagedLabel(new Map(), important)).toBeNull();
  });
});
