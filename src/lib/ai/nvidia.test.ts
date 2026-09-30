import { afterEach, describe, expect, it, vi } from "vitest";

import { generateWithNvidia, NvidiaEmailTriageProvider } from "@/lib/ai/nvidia";
import type { ThreadAnalysis } from "@/lib/ai/schemas";
import type { ThreadAnalysisInput } from "@/lib/ai/types";

const env = {
  NVIDIA_API_KEY: "nvapi-test",
  NVIDIA_MODEL: "openai/gpt-oss-20b",
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

describe("generateWithNvidia", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function captureRequest(model: string): Promise<Record<string, unknown>> {
    let body: Record<string, unknown> = {};
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        body = JSON.parse(String(init.body)) as Record<string, unknown>;
        return Response.json({
          choices: [
            {
              message: {
                content: '{"status":"action_required"}',
                reasoning_content: "thinking out loud",
              },
            },
          ],
        });
      }),
    );

    const content = await generateWithNvidia({
      apiKey: "nvapi-test",
      baseUrl: "https://integrate.api.nvidia.com/v1/",
      model,
      systemInstruction: "system",
      userPrompt: "user",
      responseJsonSchema: { type: "object" },
      signal: new AbortController().signal,
    });
    expect(content).toBe('{"status":"action_required"}');
    return body;
  }

  it("gives gpt-oss a full token budget and low reasoning effort", async () => {
    const body = await captureRequest("openai/gpt-oss-20b");
    expect(body).toMatchObject({
      model: "openai/gpt-oss-20b",
      max_tokens: 4096,
      reasoning_effort: "low",
      response_format: { type: "json_object" },
    });
  });

  it("does not send reasoning_effort for other NVIDIA models", async () => {
    const body = await captureRequest("nvidia/custom");
    expect(body).toMatchObject({ model: "nvidia/custom", max_tokens: 4096 });
    expect(body).not.toHaveProperty("reasoning_effort");
  });
});

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
        model: "openai/gpt-oss-20b",
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
