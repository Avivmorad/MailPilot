import { describe, expect, it, vi } from "vitest";

import {
  generateWithNvidia,
  NvidiaEmailTriageProvider,
  nvidiaReasoningEffortForModel,
} from "@/lib/ai/nvidia";
import type { ThreadAnalysis } from "@/lib/ai/schemas";
import type { ThreadAnalysisInput } from "@/lib/ai/types";
import { ABSENT_USAGE, type GenerateWithUsage } from "@/lib/ai/usage";

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

function textResult(text: string, usage = ABSENT_USAGE): GenerateWithUsage {
  return { text, usage };
}

describe("nvidiaReasoningEffortForModel", () => {
  it("requests low reasoning for gpt-oss models only", () => {
    expect(nvidiaReasoningEffortForModel("openai/gpt-oss-20b")).toBe("low");
    expect(nvidiaReasoningEffortForModel("openai/gpt-oss-120b")).toBe("low");
    expect(nvidiaReasoningEffortForModel("meta/llama-3.3-70b-instruct")).toBeUndefined();
  });
});

describe("NvidiaEmailTriageProvider", () => {
  it("parses a JSON chat completion into a thread analysis", async () => {
    const generate = vi.fn(async () => textResult(JSON.stringify(validPayload)));
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
    const provider = new NvidiaEmailTriageProvider(env, async () =>
      textResult("```json\n" + JSON.stringify(validPayload) + "\n```"),
    );
    await expect(provider.analyzeThread(input)).resolves.toMatchObject({
      short_display_title: "Reply requested",
    });
  });

  it("emits onProviderUsage with token counts and without prompt text", async () => {
    const events: unknown[] = [];
    const usage = {
      inputTokens: 111,
      outputTokens: 22,
      reasoningTokens: 3,
      totalTokens: 133,
      source: "provider" as const,
    };
    const provider = new NvidiaEmailTriageProvider(env, async () =>
      textResult(JSON.stringify(validPayload), usage),
    );
    await provider.analyzeThread(input, {
      onProviderUsage: (event) => {
        events.push(event);
      },
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      provider: "nvidia",
      model: "openai/gpt-oss-20b",
      attempt: 0,
      outcome: "ok",
      usage,
    });
    expect(JSON.stringify(events[0])).not.toMatch(/Please reply today|ada@example/i);
  });

  it("sends reasoning_effort low on the chat completions body for gpt-oss", async () => {
    const fetchMock = vi.fn(
      async (_url: string | URL | Request, init?: RequestInit): Promise<Response> => {
        void _url;
        void init;
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: "{}" } }],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    try {
      const result = await generateWithNvidia({
        apiKey: "nvapi-test",
        baseUrl: "https://integrate.api.nvidia.com/v1",
        model: "openai/gpt-oss-20b",
        systemInstruction: "system",
        userPrompt: "user prompt with secret@example.com",
        responseJsonSchema: { type: "object" },
        signal: new AbortController().signal,
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const init = fetchMock.mock.calls[0]?.[1];
      expect(init).toBeDefined();
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(body.reasoning_effort).toBe("low");
      expect(body.model).toBe("openai/gpt-oss-20b");
      expect(result.usage).toEqual({
        inputTokens: 1,
        outputTokens: 1,
        reasoningTokens: null,
        totalTokens: 2,
        source: "provider",
      });
      expect(JSON.stringify(result.usage)).not.toMatch(/secret@example/i);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("returns absent usage when the response has no usage object", async () => {
    const fetchMock = vi.fn(async (): Promise<Response> => {
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: "{}",
                reasoning_content: "quotes Please reply today from the mail",
              },
            },
          ],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      const result = await generateWithNvidia({
        apiKey: "nvapi-test",
        baseUrl: "https://integrate.api.nvidia.com/v1",
        model: "openai/gpt-oss-20b",
        systemInstruction: "system",
        userPrompt: "user",
        responseJsonSchema: { type: "object" },
        signal: new AbortController().signal,
      });
      expect(result.text).toBe("{}");
      expect(result.usage).toEqual(ABSENT_USAGE);
      expect(JSON.stringify(result.usage)).not.toMatch(/Please reply|reasoning_content/i);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("omits reasoning_effort for non gpt-oss models", async () => {
    const fetchMock = vi.fn(
      async (_url: string | URL | Request, init?: RequestInit): Promise<Response> => {
        void _url;
        void init;
        return new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    try {
      await generateWithNvidia({
        apiKey: "nvapi-test",
        baseUrl: "https://integrate.api.nvidia.com/v1",
        model: "meta/llama-3.3-70b-instruct",
        systemInstruction: "system",
        userPrompt: "user",
        responseJsonSchema: { type: "object" },
        signal: new AbortController().signal,
      });
      const init = fetchMock.mock.calls[0]?.[1];
      expect(init).toBeDefined();
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(body.reasoning_effort).toBeUndefined();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
