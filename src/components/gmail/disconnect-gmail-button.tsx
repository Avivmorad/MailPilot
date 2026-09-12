"use client";

import { type FormEvent } from "react";

import { Button } from "@/components/ui/button";

export function DisconnectGmailButton() {
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (
      !window.confirm(
        "Disconnect Gmail? MailPilot will stop scanning. Historical summaries stay until you delete analysis data.",
      )
    ) {
      event.preventDefault();
    }
  }

  return (
    <form action="/api/gmail/disconnect" method="post" onSubmit={onSubmit}>
      <Button type="submit" variant="destructive" aria-label="Disconnect Gmail from MailPilot">
        Disconnect Gmail
      </Button>
    </form>
  );
}
