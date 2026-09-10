"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { FEEDBACK_KINDS } from "@/lib/threads/feedback";

const LABELS: Record<(typeof FEEDBACK_KINDS)[number], string> = {
  wrong: "This classification is wrong",
  important: "Important",
  not_important: "Not important",
  action: "Action",
  no_action: "No action",
  waiting: "Waiting",
  not_waiting: "Not waiting",
};

export function ThreadFeedback({ threadId }: { threadId: string }) {
  const [message, setMessage] = useState<string | null>(null);

  async function send(kind: (typeof FEEDBACK_KINDS)[number]) {
    setMessage(null);
    const response = await fetch(`/api/threads/${threadId}/feedback`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind }),
    });
    setMessage(response.ok ? "Saved for future evals." : "Could not save feedback.");
  }

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-sm">This classification is wrong?</p>
      <div className="flex flex-wrap gap-2">
        {FEEDBACK_KINDS.map((kind) => (
          <Button key={kind} type="button" size="sm" variant="outline" onClick={() => void send(kind)}>
            {LABELS[kind]}
          </Button>
        ))}
      </div>
      {message ? <p className="text-muted-foreground text-xs">{message}</p> : null}
    </div>
  );
}
