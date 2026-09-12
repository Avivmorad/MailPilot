import { GoogleGenAI } from "@google/genai";

import { ThreadTriageError, type EmailTriageProvider } from "@/lib/ai/analyze-thread";
import { buildTriageUserPrompt, TRIAGE_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import {
  threadAnalysisJsonSchema,
  threadAnalysisSchema,
  type ThreadAnalysis,
} from "@/lib/ai/schemas";
import type { ThreadAnalysisInput } from "@/lib/ai/types";
import { getGeminiEnv, type GeminiEnv } from "@/lib/config/env";

const MAX_ATTEMPTS = 3;

export interface GeminiGenerateParams {
  apiKey: string;
  model: string;
  systemInstruction: string;
  userPrompt: string;
  responseJsonSchema: unknown;
}

export type GeminiGenerateFn = (params: GeminiGenerateParams) => Promise<string>;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
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

export async function generateWithGemini(params: GeminiGenerateParams): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: params.apiKey });
  const response = await ai.models.generateContent({
    model: params.model,
    contents: params.userPrompt,
    config: {
      systemInstruction: params.systemInstruction,
      temperature: 0,
      responseMimeType: "application/json",
      responseJsonSchema: params.responseJsonSchema,
    },
  });
  return response.text ?? "";
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

  async analyzeThread(input: ThreadAnalysisInput): Promise<ThreadAnalysis> {
    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      try {
        return await this.completeOnce(input);
      } catch (error) {
        lastError = error;
        const delay = retryDelayMs(error, attempt);
        if (delay === null || attempt === MAX_ATTEMPTS - 1) {
          break;
        }
        await sleep(delay);
      }
    }
    if (lastError instanceof ThreadTriageError) {
      throw lastError;
    }
    throw new ThreadTriageError("provider", "Gemini triage call failed", lastError);
  }

  private async completeOnce(input: ThreadAnalysisInput): Promise<ThreadAnalysis> {
    const content = await this.generate({
      apiKey: this.apiKey,
      model: this.model,
      systemInstruction: TRIAGE_SYSTEM_PROMPT,
      userPrompt: buildTriageUserPrompt(input),
      responseJsonSchema: threadAnalysisJsonSchema,
    });

    if (!content) {
      throw new ThreadTriageError("schema", "Gemini returned an empty triage payload");
    }

    let json: unknown;
    try {
      json = JSON.parse(content) as unknown;
    } catch (error) {
      throw new ThreadTriageError("schema", "Gemini returned non-JSON triage payload", error);
    }

    const parsed = threadAnalysisSchema.safeParse(json);
    if (!parsed.success) {
      throw new ThreadTriageError("schema", "Gemini JSON failed schema validation", parsed.error);
    }
    return parsed.data;
  }
}

export function createEmailTriageProvider(env?: GeminiEnv): EmailTriageProvider {
  return new GeminiEmailTriageProvider(env);
}
