import { describe, expect, it, vi } from "vitest";

import { NvidiaEmailTriageProvider } from "@/lib/ai/nvidia";
import type { ThreadAnalysis } from "@/lib/ai/schemas";
import type { ThreadAnalysisInput } from "@/lib/ai/types";

const env = {
  NVIDIA_API_KEY: "nvapi-test",
  NVIDIA_MODEL: "meta/llama-3.3-70b-instruct",
  NVIDIA_BASE_URL: "https://integrate.api.nvidia.com/v1",
};

const input: ThreadAnalysisInput = {
  userEmails: ["me@example.com"],
  threadText: "Please reply today.",
  latestFrom: "ada@example.com",
  latestSubject: "Ping",
  latestDirection: "INBOUND",
};

const validPayload: ThreadAnalysis = {
  summary: "Reply requested today",
  importance: "medium",
  importance_reason: "direct question",
  status: "action_required",
  requires_action: true,
  requires_reply: true,
  action_type: "reply",
  action_summary: "Reply to the email",
  action_reason: "asked for a reply",
  waiting_for: null,
  waiting_since: null,
  urgency: "soon",
  deadline: null,
  deadline_text: "today",
  category: "other",
  sender_name: "Ada",
  organization: null,
  confidence: 0.8,
  short_display_title: "Reply requested",
};

describe("NvidiaEmailTriageProvider", () => {
  it("parses a JSON chat completion into a thread analysis", async () => {
    const generate = vi.fn(async () => JSON.stringify(validPayload));
    const provider = new NvidiaEmailTriageProvider(env, generate);
    await expect(provider.analyzeThread(input)).resolves.toMatchObject({
      status: "action_required",
      requires_reply: true,
    });
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "meta/llama-3.3-70b-instruct",
        baseUrl: "https://integrate.api.nvidia.com/v1",
      }),
    );
  });

  it("accepts JSON wrapped in a markdown fence", async () => {
    const provider = new NvidiaEmailTriageProvider(env, async () => {
      return "```json\n" + JSON.stringify(validPayload) + "\n```";
    });
    await expect(provider.analyzeThread(input)).resolves.toMatchObject({
      short_display_title: "Reply requested",
    });
  });
});
