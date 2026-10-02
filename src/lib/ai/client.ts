import { GoogleGenAI } from "@google/genai";

import {
  ThreadTriageError,
  type EmailTriageProvider,
  type TriageRequestOptions,
} from "@/lib/ai/analyze-thread";
import { NvidiaEmailTriageProvider } from "@/lib/ai/nvidia";
import { buildTriageUserPrompt, TRIAGE_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import {
  threadAnalysisJsonSchema,
  threadAnalysisSchema,
  type ThreadAnalysis,
} from "@/lib/ai/schemas";
import type { ThreadAnalysisInput } from "@/lib/ai/types";
import {
  ABSENT_USAGE,
  emitProviderUsage,
  parseGeminiUsage,
  usageOutcomeFromProviderError,
  type GenerateWithUsage,
} from "@/lib/ai/usage";
import { getGeminiEnv, isNvidiaConfigured, type GeminiEnv } from "@/lib/config/env";

const MAX_ATTEMPTS = 2;
export const GEMINI_REQUEST_TIMEOUT_MS = 25_000;

export interface GeminiGenerateParams {
  apiKey: string;
  model: string;
  systemInstruction: string;
  userPrompt: string;
  responseJsonSchema: unknown;
  signal: AbortSignal;
}

export type GeminiGenerateFn = (params: GeminiGenerateParams) => Promise<GenerateWithUsage>;

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const cancel = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", cancel);
      resolve();
    }, ms);
    signal?.addEventListener("abort", cancel, { once: true });
  });
}

function httpStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }
  if ("status" in error && typeof error.status === "number") {
    return error.status;
  }
  if ("statusCode" in error && typeof error.statusCode === "number") {
    return error.statusCode;
  }
  return undefined;
}

function retryDelayMs(error: unknown, attempt: number): number | null {
  const status = httpStatus(error);
  if (status !== 429 && status !== 503) {
    return null;
  }
  return Math.min(500 * 2 ** attempt, 8_000);
}

export async function generateWithGemini(params: GeminiGenerateParams): Promise<GenerateWithUsage> {
  const ai = new GoogleGenAI({
    apiKey: params.apiKey,
    httpOptions: { timeout: GEMINI_REQUEST_TIMEOUT_MS, retryOptions: { attempts: 1 } },
  });
  const response = await ai.models.generateContent({
    model: params.model,
    contents: params.userPrompt,
    config: {
      systemInstruction: params.systemInstruction,
      temperature: 0,
      abortSignal: params.signal,
      responseMimeType: "application/json",
      responseJsonSchema: params.responseJsonSchema,
    },
  });
  const usage = parseGeminiUsage(response.usageMetadata);
  return { text: response.text ?? "", usage };
}

export class GeminiEmailTriageProvider implements EmailTriageProvider {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly generate: GeminiGenerateFn;

  constructor(env: GeminiEnv = getGeminiEnv(), generate: GeminiGenerateFn = generateWithGemini) {
    this.apiKey = env.GEMINI_API_KEY;
    this.model = env.GEMINI_MODEL;
    this.generate = generate;
  }

  async analyzeThread(
    input: ThreadAnalysisInput,
    options: TriageRequestOptions = {},
  ): Promise<ThreadAnalysis> {
    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      options.signal?.throwIfAborted();
      try {
        return await this.completeOnce(input, options, attempt);
      } catch (error) {
        if (options.signal?.aborted) throw options.signal.reason;
        lastError = error;
        const delay = retryDelayMs(error, attempt);
        if (delay === null || attempt === MAX_ATTEMPTS - 1) {
          break;
        }
        await sleep(delay, options.signal);
      }
    }
    if (lastError instanceof ThreadTriageError) {
      throw lastError;
    }
    throw new ThreadTriageError("provider", "Gemini triage call failed", lastError);
  }

  private async completeOnce(
    input: ThreadAnalysisInput,
    options: TriageRequestOptions,
    attempt: number,
  ): Promise<ThreadAnalysis> {
    const controller = new AbortController();
    const cancel = () => controller.abort(options.signal?.reason);
    options.signal?.addEventListener("abort", cancel, { once: true });
    let rejectOnAbort: () => void;
    const interrupted = new Promise<never>((_resolve, reject) => {
      rejectOnAbort = () => reject(controller.signal.reason);
      controller.signal.addEventListener("abort", rejectOnAbort, { once: true });
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();
    let content = "";
    let usage = ABSENT_USAGE;
    try {
      const generated = await Promise.race([
        this.generate({
          apiKey: this.apiKey,
          model: this.model,
          systemInstruction: TRIAGE_SYSTEM_PROMPT,
          userPrompt: buildTriageUserPrompt(input),
          responseJsonSchema: threadAnalysisJsonSchema,
          signal: controller.signal,
        }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            reject(new ThreadTriageError("provider", "Gemini triage request timed out"));
            controller.abort();
          }, GEMINI_REQUEST_TIMEOUT_MS);
        }),
        interrupted,
      ]);
      content = generated.text;
      usage = generated.usage;
    } catch (error) {
      await emitProviderUsage(options.onProviderUsage, {
        provider: "gemini",
        model: this.model,
        attempt,
        outcome: usageOutcomeFromProviderError(error, options.signal),
        durationMs: Date.now() - startedAt,
        usage: ABSENT_USAGE,
      });
      throw error;
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", cancel);
      controller.signal.removeEventListener("abort", rejectOnAbort!);
    }

    const durationMs = Date.now() - startedAt;
    const baseEvent = {
      provider: "gemini" as const,
      model: this.model,
      attempt,
      durationMs,
      usage,
    };

    if (!content) {
      await emitProviderUsage(options.onProviderUsage, { ...baseEvent, outcome: "schema" });
      throw new ThreadTriageError("schema", "Gemini returned an empty triage payload");
    }

    let json: unknown;
    try {
      json = JSON.parse(content) as unknown;
    } catch (error) {
      await emitProviderUsage(options.onProviderUsage, { ...baseEvent, outcome: "schema" });
      throw new ThreadTriageError("schema", "Gemini returned non-JSON triage payload", error);
    }

    const parsed = threadAnalysisSchema.safeParse(json);
    if (!parsed.success) {
      await emitProviderUsage(options.onProviderUsage, { ...baseEvent, outcome: "schema" });
      throw new ThreadTriageError("schema", "Gemini JSON failed schema validation", parsed.error);
    }
    await emitProviderUsage(options.onProviderUsage, { ...baseEvent, outcome: "ok" });
    return parsed.data;
  }
}

export function createEmailTriageProvider(env?: GeminiEnv): EmailTriageProvider {
  if (isNvidiaConfigured()) {
    return new NvidiaEmailTriageProvider();
  }
  return new GeminiEmailTriageProvider(env);
}
