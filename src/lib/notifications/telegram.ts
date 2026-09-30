import { isTelegramConfigured, parseTelegramEnv } from "@/lib/config/env";
import type { ScanCounters } from "@/lib/scans/types";

const TELEGRAM_TIMEOUT_MS = 3_000;

type TelegramScanStatus = "SUCCESS" | "PARTIAL" | "FAILED";

function statusLine(status: TelegramScanStatus): string {
  if (status === "SUCCESS") return "✅ Scan completed";
  if (status === "PARTIAL") return "⚠️ Scan completed with some errors";
  return "❌ Scan failed";
}

export function formatTelegramScanMessage(input: {
  status: TelegramScanStatus;
  counters: ScanCounters;
  failedThreads?: number;
  errorCode?: string;
}): string {
  const { status, counters } = input;
  const lines = [
    "📬 MailPilot",
    statusLine(status),
    "",
    `Threads analyzed: ${counters.threadsAnalyzed}`,
    `Important: ${counters.importantCount}`,
    `Needs action: ${counters.actionCount}`,
    `Needs reply: ${counters.replyCount}`,
    `Waiting: ${counters.waitingCount}`,
    `Informational: ${counters.informationalCount}`,
    `Ignored: ${counters.ignoredCount}`,
  ];

  if (input.failedThreads && input.failedThreads > 0) {
    lines.push(`Failed threads: ${input.failedThreads}`);
  }
  if (input.errorCode) {
    lines.push(`Error: ${input.errorCode}`);
  }

  return lines.join("\n");
}

export async function sendTelegramMessage(
  text: string,
  source: Record<string, unknown> = process.env,
): Promise<boolean> {
  if (!isTelegramConfigured(source)) {
    return false;
  }

  const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = parseTelegramEnv(source);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TELEGRAM_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text,
          disable_web_page_preview: true,
        }),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      return false;
    }

    const body = (await response.json()) as { ok?: boolean };
    return body.ok === true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function notifyTelegramScanResult(
  input: {
    status: TelegramScanStatus;
    counters: ScanCounters;
    failedThreads?: number;
    errorCode?: string;
  },
  source: Record<string, unknown> = process.env,
): Promise<boolean> {
  if (!isTelegramConfigured(source)) {
    return false;
  }

  return sendTelegramMessage(formatTelegramScanMessage(input), source);
}
