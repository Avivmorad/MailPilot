"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { TriageListField } from "@/components/settings/triage-list-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DEFAULT_LOOKBACK_DAYS } from "@/lib/scans/lookback";
import { CUSTOM_AI_INSTRUCTIONS_MAX } from "@/lib/settings/limits";
import {
  TRIAGE_CARD_DESCRIPTION,
  TRIAGE_SETTINGS_SAVED_MESSAGE,
  TRIAGE_UPDATE_STARTED_MESSAGE,
} from "@/lib/settings/schedule-copy";
import { parseTriageDomain, parseTriageSender } from "@/lib/settings/triage-lists";

export function TriagePreferencesForm({
  vipSenders,
  ignoredSenders,
  ignoredDomains,
  customAiInstructions,
  digestEnabled,
}: {
  vipSenders: string[];
  ignoredSenders: string[];
  ignoredDomains: string[];
  customAiInstructions: string;
  digestEnabled: boolean;
}) {
  const router = useRouter();
  const [vip, setVip] = useState(vipSenders);
  const [ignored, setIgnored] = useState(ignoredSenders);
  const [domains, setDomains] = useState(ignoredDomains);
  const [instructions, setInstructions] = useState(customAiInstructions);
  const [digest, setDigest] = useState(digestEnabled);
  const [busy, setBusy] = useState<"save" | "update" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);

  function payload() {
    return {
      vipSenders: vip,
      ignoredSenders: ignored,
      ignoredDomains: domains,
      customAiInstructions: instructions,
      digestEnabled: digest,
    };
  }

  async function saveSettings(): Promise<boolean> {
    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload()),
    });
    if (!response.ok) {
      setError(true);
      setMessage(
        response.status === 401
          ? "Sign in to save triage settings."
          : "Could not save triage settings. Check emails, domains, and instruction length.",
      );
      return false;
    }
    return true;
  }

  async function save() {
    setBusy("save");
    setMessage(null);
    setError(false);
    try {
      const ok = await saveSettings();
      if (!ok) {
        return;
      }
      setMessage(TRIAGE_SETTINGS_SAVED_MESSAGE);
      router.refresh();
    } catch {
      setError(true);
      setMessage("Could not save triage settings.");
    } finally {
      setBusy(null);
    }
  }

  async function updateNow() {
    setBusy("update");
    setMessage(null);
    setError(false);
    try {
      const saved = await saveSettings();
      if (!saved) {
        return;
      }
      const response = await fetch("/api/scans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lookbackDays: DEFAULT_LOOKBACK_DAYS }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          message?: string;
          error?: string;
        } | null;
        setError(true);
        setMessage(
          body?.message ??
            "Settings were saved, but Update Now could not start. Try Scan now on the Scan tab.",
        );
        router.refresh();
        return;
      }
      setMessage(TRIAGE_UPDATE_STARTED_MESSAGE);
      router.refresh();
    } catch {
      setError(true);
      setMessage("Settings may not have been applied. Try again, or use Scan now on the Scan tab.");
    } finally {
      setBusy(null);
    }
  }

  const disabled = busy !== null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Triage</CardTitle>
        <CardDescription>{TRIAGE_CARD_DESCRIPTION}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <TriageListField
          label="VIP senders"
          values={vip}
          onChange={setVip}
          parseValue={parseTriageSender}
          placeholder="vip@example.com"
          invalidMessage="Enter a valid email address."
          disabled={disabled}
          inputMode="email"
        />
        <TriageListField
          label="Ignored senders"
          values={ignored}
          onChange={setIgnored}
          parseValue={parseTriageSender}
          placeholder="noise@example.com"
          invalidMessage="Enter a valid email address."
          disabled={disabled}
          inputMode="email"
        />
        <TriageListField
          label="Ignored domains"
          values={domains}
          onChange={setDomains}
          parseValue={parseTriageDomain}
          placeholder="newsletters.example.com"
          invalidMessage="Enter a valid domain (for example newsletters.example.com)."
          disabled={disabled}
        />
        <label className="block text-sm">
          <span className="text-muted-foreground mb-1.5 block">
            Custom triage instructions ({instructions.length}/{CUSTOM_AI_INSTRUCTIONS_MAX})
          </span>
          <textarea
            className="border-input bg-background min-h-28 w-full rounded-lg border px-3 py-2 text-sm"
            value={instructions}
            maxLength={CUSTOM_AI_INSTRUCTIONS_MAX}
            onChange={(event) => setInstructions(event.target.value)}
            disabled={disabled}
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={digest}
            onChange={(event) => setDigest(event.target.checked)}
            disabled={disabled}
          />
          Add an entry to History after each successful or partial scan
        </label>
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={disabled} onClick={() => void save()}>
            {busy === "save" ? "Saving…" : "Save triage settings"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={() => void updateNow()}
          >
            {busy === "update" ? "Updating…" : "Update Now"}
          </Button>
        </div>
        {message ? (
          <p
            className={error ? "text-destructive text-sm" : "text-sm"}
            role={error ? "alert" : "status"}
          >
            {message}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
