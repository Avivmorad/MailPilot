import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EmailTriageProvider } from "@/lib/ai/analyze-thread";
import { GeminiEmailTriageProvider } from "@/lib/ai/client";
import { NvidiaEmailTriageProvider } from "@/lib/ai/nvidia";
import type { ThreadAnalysisInput } from "@/lib/ai/types";
import type { GenerateWithUsage } from "@/lib/ai/usage";

const input: ThreadAnalysisInput = {
  userEmails: ["me@example.test"],
  threadText: "Synthetic cancellation fixture.",
  latestFrom: "sender@example.test",
  latestSubject: "Test",
  latestDirection: "INBOUND",
};

type Generate = (params: { signal: AbortSignal }) => Promise<GenerateWithUsage>;
const providers: Array<[string, (generate: Generate) => EmailTriageProvider]> = [
  [
    "Gemini",
    (generate) =>
      new GeminiEmailTriageProvider(
        { GEMINI_API_KEY: "synthetic", GEMINI_MODEL: "synthetic-model" },
        generate,
      ),
  ],
  [
    "NVIDIA",
    (generate) =>
      new NvidiaEmailTriageProvider(
        {
          NVIDIA_API_KEY: "synthetic",
          NVIDIA_MODEL: "synthetic-model",
          NVIDIA_BASE_URL: "https://synthetic.invalid/v1",
        },
        generate,
      ),
  ],
];

describe.each(providers)("%s caller cancellation", (_name, createProvider) => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("aborts a hung generation without retrying or leaving a timer", async () => {
    const controller = new AbortController();
    let requestSignal: AbortSignal | undefined;
    const generate = vi.fn(({ signal }: { signal: AbortSignal }) => {
      requestSignal = signal;
      return new Promise<GenerateWithUsage>(() => undefined);
    });
    const failure = new Error("caller slice ended");
    const result = createProvider(generate).analyzeThread(input, { signal: controller.signal });
    const assertion = expect(result).rejects.toBe(failure);
    controller.abort(failure);
    await assertion;
    expect(requestSignal?.aborted).toBe(true);
    expect(requestSignal?.reason).toBe(failure);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([429, 503])("cancels %s backoff without making a second request", async (status) => {
    const controller = new AbortController();
    const generate = vi.fn(async () => {
      throw Object.assign(new Error("synthetic retry"), { status });
    });
    const failure = new Error("caller cancelled while waiting");
    const result = createProvider(generate).analyzeThread(input, { signal: controller.signal });
    const assertion = expect(result).rejects.toBe(failure);
    await vi.advanceTimersByTimeAsync(1);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);
    controller.abort(failure);
    await assertion;
    await vi.advanceTimersByTimeAsync(1000);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not admit a request when already cancelled", async () => {
    const controller = new AbortController();
    const failure = new Error("already cancelled");
    controller.abort(failure);
    const generate = vi.fn(async () => ({
      text: "{}",
      usage: {
        inputTokens: null,
        outputTokens: null,
        reasoningTokens: null,
        totalTokens: null,
        source: "absent" as const,
      },
    }));
    await expect(
      createProvider(generate).analyzeThread(input, { signal: controller.signal }),
    ).rejects.toBe(failure);
    expect(generate).not.toHaveBeenCalled();
  });
});
