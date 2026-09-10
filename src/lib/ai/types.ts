import type { TriagePreferences } from "@/lib/ai/post-process";
import type { MessageDirection } from "@/lib/gmail/addresses";
import type { ThreadContext } from "@/lib/gmail/thread-context";

export interface ThreadAnalysisInput {
  userEmails: string[];
  threadText: string;
  latestFrom: string | null;
  latestSubject: string | null;
  latestDirection: MessageDirection | null;
  preferences?: Partial<TriagePreferences>;
}

export function threadAnalysisInputFromContext(
  context: ThreadContext,
  userEmails: string[],
  preferences?: Partial<TriagePreferences>,
): ThreadAnalysisInput {
  const latest = context.messages.at(-1);
  return {
    userEmails,
    threadText: context.promptText,
    latestFrom: latest?.from ?? null,
    latestSubject: latest?.subject ?? null,
    latestDirection: latest?.direction ?? null,
    preferences,
  };
}
