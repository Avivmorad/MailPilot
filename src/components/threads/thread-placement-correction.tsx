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

  async function send(kind: FeedbackKind) {
    setBusy(kind);
    setMessage(null);
    try {
      const response = await fetch(`/api/threads/${threadId}/feedback`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      if (!response.ok) {
        setMessage("Could not apply the correction.");
        return;
      }
      setMessage("Updated. This thread now follows your correction.");
      router.refresh();
    } catch {
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
        <p className="text-muted-foreground text-xs" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
