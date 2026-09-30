import {
  ThreadTriageError,
  type EmailTriageProvider,
  type TriageRequestOptions,
} from "@/lib/ai/analyze-thread";
import { buildTriageUserPrompt, TRIAGE_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import {
  threadAnalysisJsonSchema,
  threadAnalysisSchema,
  type ThreadAnalysis,
} from "@/lib/ai/schemas";
import type { ThreadAnalysisInput } from "@/lib/ai/types";
import { getNvidiaEnv, type NvidiaEnv } from "@/lib/config/env";

const MAX_ATTEMPTS = 2;
export const NVIDIA_REQUEST_TIMEOUT_MS = 25_000;
/** NVIDIA's gpt-oss chat API allows at most 4096 completion tokens. */
const NVIDIA_MAX_OUTPUT_TOKENS = 4096;

function isGptOssModel(model: string): boolean {
  return model.toLowerCase().includes("gpt-oss");
}

export type NvidiaGenerateFn = (params: {
  apiKey: string;
  baseUrl: string;
  model: string;
  systemInstruction: string;
  userPrompt: string;
  responseJsonSchema: unknown;
  signal: AbortSignal;
}) => Promise<string>;

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
  if (error && typeof error === "object" && "status" in error && typeof error.status === "number") {
    return error.status;
  }
  return undefined;
}

function extractJsonText(content: string): string {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fenced?.[1]?.trim() || trimmed;
}

export async function generateWithNvidia(params: Parameters<NvidiaGenerateFn>[0]): Promise<string> {
  const response = await fetch(`${params.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${params.apiKey}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    signal: params.signal,
    body: JSON.stringify({
      model: params.model,
      temperature: 0,
      // gpt-oss spends this budget on reasoning_content first. The hosted API
      // defaults to medium effort, which can exhaust a smaller cap and return
      // an empty message.content. Low effort keeps the JSON in content.
      max_tokens: NVIDIA_MAX_OUTPUT_TOKENS,
      ...(isGptOssModel(params.model) ? { reasoning_effort: "low" } : {}),
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `${params.systemInstruction}\n\nReturn one JSON object matching this schema:\n${JSON.stringify(params.responseJsonSchema)}`,
        },
        { role: "user", content: params.userPrompt },
      ],
    }),
  });
  if (!response.ok) {
    throw Object.assign(new Error("NVIDIA triage request failed"), { status: response.status });
  }
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  return payload.choices?.[0]?.message?.content ?? "";
}

export class NvidiaEmailTriageProvider implements EmailTriageProvider {
  private readonly env: NvidiaEnv;
  private readonly generate: NvidiaGenerateFn;

  constructor(env: NvidiaEnv = getNvidiaEnv(), generate: NvidiaGenerateFn = generateWithNvidia) {
    this.env = env;
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
        return await this.completeOnce(input, options);
      } catch (error) {
        if (options.signal?.aborted) throw options.signal.reason;
        lastError = error;
        const status = httpStatus(error);
        if ((status !== 429 && status !== 503) || attempt === MAX_ATTEMPTS - 1) {
          break;
        }
        await sleep(Math.min(500 * 2 ** attempt, 8_000), options.signal);
      }
    }
    if (lastError instanceof ThreadTriageError) {
      throw lastError;
    }
    throw new ThreadTriageError("provider", "NVIDIA triage call failed", lastError);
  }

  private async completeOnce(
    input: ThreadAnalysisInput,
    options: TriageRequestOptions,
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
    let content: string;
    try {
      content = await Promise.race([
        this.generate({
          apiKey: this.env.NVIDIA_API_KEY,
          baseUrl: this.env.NVIDIA_BASE_URL,
          model: this.env.NVIDIA_MODEL,
          systemInstruction: TRIAGE_SYSTEM_PROMPT,
          userPrompt: buildTriageUserPrompt(input),
          responseJsonSchema: threadAnalysisJsonSchema,
          signal: controller.signal,
        }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            reject(new ThreadTriageError("provider", "NVIDIA triage request timed out"));
            controller.abort();
          }, NVIDIA_REQUEST_TIMEOUT_MS);
        }),
        interrupted,
      ]);
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", cancel);
      controller.signal.removeEventListener("abort", rejectOnAbort!);
    }

    if (!content) {
      throw new ThreadTriageError("schema", "NVIDIA returned an empty triage payload");
    }

    let json: unknown;
    try {
      json = JSON.parse(extractJsonText(content)) as unknown;
    } catch (error) {
      throw new ThreadTriageError("schema", "NVIDIA returned non-JSON triage payload", error);
    }

    const parsed = threadAnalysisSchema.safeParse(json);
    if (!parsed.success) {
      throw new ThreadTriageError("schema", "NVIDIA JSON failed schema validation", parsed.error);
    }
    return parsed.data;
  }
}
