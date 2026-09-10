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
    <div className="bg-card ring-foreground/10 space-y-3 rounded-xl p-4 ring-1 sm:p-5">
      <div>
        <p className="text-foreground font-semibold tracking-tight">Was this classification right?</p>
        <p className="text-muted-foreground mt-0.5 text-sm">Your feedback is saved for later evaluation — it does not change this thread yet.</p>
      </div>
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
