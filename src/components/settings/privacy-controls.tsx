"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DELETE_ACCOUNT_CONFIRMATION,
  DELETE_ANALYSIS_CONFIRMATION,
} from "@/lib/privacy/confirmations";

export function PrivacyControls() {
  const router = useRouter();
  const [analysisConfirm, setAnalysisConfirm] = useState("");
  const [accountConfirm, setAccountConfirm] = useState("");
  const [busy, setBusy] = useState<"analysis" | "account" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);

  async function deleteAnalysis() {
    setBusy("analysis");
    setMessage(null);
    setError(false);
    try {
      const response = await fetch("/api/privacy/delete-analysis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmation: analysisConfirm }),
      });
      if (!response.ok) {
        setError(true);
        setMessage("Could not delete analysis data. Type DELETE ANALYSIS exactly.");
        return;
      }
      setAnalysisConfirm("");
      setMessage("Analysis data deleted. Gmail stays connected unless you disconnect it.");
      router.refresh();
    } catch {
      setError(true);
      setMessage("Could not delete analysis data.");
    } finally {
      setBusy(null);
    }
  }

  async function deleteAccount() {
    setBusy("account");
    setMessage(null);
    setError(false);
    try {
      const response = await fetch("/api/privacy/delete-account", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmation: accountConfirm }),
      });
      const payload = (await response.json().catch(() => ({}))) as { redirectTo?: string };
      if (!response.ok) {
        setError(true);
        setMessage("Could not delete the account. Type DELETE ACCOUNT exactly.");
        return;
      }
      window.location.assign(payload.redirectTo ?? "/");
    } catch {
      setError(true);
      setMessage("Could not delete the account.");
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Privacy</CardTitle>
        <CardDescription>
          These actions only affect your MailPilot data. Disconnecting Gmail keeps summaries.
          Deleting analysis data removes mail that MailPilot stored. Deleting the account
          removes everything and signs you out.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="space-y-2">
          <h3 className="text-sm font-medium">Delete analysis data</h3>
          <p className="text-muted-foreground text-sm">
            Removes stored messages, threads, actions, digests, and scan history. Does not
            disconnect Gmail or delete your MailPilot login.
          </p>
          <label className="block text-sm">
            <span className="text-muted-foreground mb-1.5 block">
              Type {DELETE_ANALYSIS_CONFIRMATION} to confirm
            </span>
            <input
              className="border-input bg-background h-9 w-full max-w-md rounded-lg border px-3 text-sm"
              value={analysisConfirm}
              onChange={(event) => setAnalysisConfirm(event.target.value)}
              disabled={busy !== null}
              autoComplete="off"
            />
          </label>
          <Button
            type="button"
            variant="destructive"
            disabled={busy !== null || analysisConfirm !== DELETE_ANALYSIS_CONFIRMATION}
            onClick={() => void deleteAnalysis()}
          >
            {busy === "analysis" ? "Deleting…" : "Delete analysis data"}
          </Button>
        </section>
        <section className="space-y-2">
          <h3 className="text-sm font-medium">Delete MailPilot account</h3>
          <p className="text-muted-foreground text-sm">
            Revokes Gmail access when possible, deletes all owned product data, and removes your
            login.
          </p>
          <label className="block text-sm">
            <span className="text-muted-foreground mb-1.5 block">
              Type {DELETE_ACCOUNT_CONFIRMATION} to confirm
            </span>
            <input
              className="border-input bg-background h-9 w-full max-w-md rounded-lg border px-3 text-sm"
              value={accountConfirm}
              onChange={(event) => setAccountConfirm(event.target.value)}
              disabled={busy !== null}
              autoComplete="off"
            />
          </label>
          <Button
            type="button"
            variant="destructive"
            disabled={busy !== null || accountConfirm !== DELETE_ACCOUNT_CONFIRMATION}
            onClick={() => void deleteAccount()}
          >
            {busy === "account" ? "Deleting…" : "Delete account"}
          </Button>
        </section>
        {message ? (
          <p className={error ? "text-destructive text-sm" : "text-sm"}>{message}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
