"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { PLACEMENT_CORRECTION_LABELS, PLACEMENT_CORRECTIONS } from "@/lib/mail/placement";
import type { MailTab } from "@/lib/mail/tabs";
import type { FeedbackKind } from "@/lib/threads/apply-feedback";

export function ThreadPlacementCorrection({ threadId, tab }: { threadId: string; tab: MailTab }) {
  const router = useRouter();
  const kinds = PLACEMENT_CORRECTIONS[tab];
  const [busy, setBusy] = useState<FeedbackKind | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);

  async function send(kind: FeedbackKind) {
    setBusy(kind);
    setMessage(null);
    setError(false);
    try {
      const response = await fetch(`/api/threads/${threadId}/feedback`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      const payload = (await response.json().catch(() => ({}))) as { applied?: boolean };
      if (!response.ok) {
        setError(true);
        setMessage("Could not apply the correction.");
        return;
      }
      if (!payload.applied) {
        setError(true);
        setMessage("Could not apply the correction.");
        return;
      }
      setMessage("Updated. This thread now follows your correction.");
      router.refresh();
    } catch {
      setError(true);
      setMessage("Could not apply the correction.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-2">
        {kinds.map((kind) => (
          <Button
            key={kind}
            type="button"
            size="xs"
            variant="outline"
            disabled={busy !== null}
            aria-busy={busy === kind}
            onClick={() => void send(kind)}
          >
            {PLACEMENT_CORRECTION_LABELS[kind]}
          </Button>
        ))}
      </div>
      {message ? (
        <p
          className={error ? "text-destructive text-xs" : "text-muted-foreground text-xs"}
          role={error ? "alert" : "status"}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
