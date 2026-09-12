"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CUSTOM_AI_INSTRUCTIONS_MAX } from "@/lib/settings/limits";

function listToLines(values: string[]): string {
  return values.join("\n");
}

function linesToList(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

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
  const [vip, setVip] = useState(listToLines(vipSenders));
  const [ignored, setIgnored] = useState(listToLines(ignoredSenders));
  const [domains, setDomains] = useState(listToLines(ignoredDomains));
  const [instructions, setInstructions] = useState(customAiInstructions);
  const [digest, setDigest] = useState(digestEnabled);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);

  async function save() {
    setBusy(true);
    setMessage(null);
    setError(false);
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          vipSenders: linesToList(vip),
          ignoredSenders: linesToList(ignored),
          ignoredDomains: linesToList(domains),
          customAiInstructions: instructions,
          digestEnabled: digest,
        }),
      });
      if (!response.ok) {
        setError(true);
        setMessage("Could not save triage settings. Check emails, domains, and instruction length.");
        return;
      }
      setMessage("Triage settings saved. The next scan will use them.");
      router.refresh();
    } catch {
      setError(true);
      setMessage("Could not save triage settings.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Triage</CardTitle>
        <CardDescription>
          VIP and ignore lists change classification on the next scan. Custom instructions are
          trusted settings, never taken from email content.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="block text-sm">
          <span className="text-muted-foreground mb-1.5 block">VIP senders (one email per line)</span>
          <textarea
            className="border-input bg-background min-h-24 w-full rounded-lg border px-3 py-2 text-sm"
            value={vip}
            onChange={(event) => setVip(event.target.value)}
            disabled={busy}
            spellCheck={false}
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground mb-1.5 block">Ignored senders (one email per line)</span>
          <textarea
            className="border-input bg-background min-h-24 w-full rounded-lg border px-3 py-2 text-sm"
            value={ignored}
            onChange={(event) => setIgnored(event.target.value)}
            disabled={busy}
            spellCheck={false}
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground mb-1.5 block">Ignored domains (one domain per line)</span>
          <textarea
            className="border-input bg-background min-h-20 w-full rounded-lg border px-3 py-2 text-sm"
            value={domains}
            onChange={(event) => setDomains(event.target.value)}
            disabled={busy}
            spellCheck={false}
            placeholder="newsletters.example.com"
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground mb-1.5 block">
            Custom triage instructions ({instructions.length}/{CUSTOM_AI_INSTRUCTIONS_MAX})
          </span>
          <textarea
            className="border-input bg-background min-h-28 w-full rounded-lg border px-3 py-2 text-sm"
            value={instructions}
            maxLength={CUSTOM_AI_INSTRUCTIONS_MAX}
            onChange={(event) => setInstructions(event.target.value)}
            disabled={busy}
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={digest}
            onChange={(event) => setDigest(event.target.checked)}
            disabled={busy}
          />
          Generate an in-app digest after each successful or partial scan
        </label>
        <Button type="button" disabled={busy} onClick={() => void save()}>
          {busy ? "Saving…" : "Save triage settings"}
        </Button>
        {message ? (
          <p className={error ? "text-destructive text-sm" : "text-sm"}>{message}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
