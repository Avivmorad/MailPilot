export const PRODUCT_EVENT_NAMES = [
  "gmail.connected",
  "gmail.disconnected",
  "gmail.reconnect_required",
  "gmail.connect_failed",
  "scan.started",
  "scan.completed",
  "scan.partial",
  "scan.failed",
  "thread.analyzed",
  "action.upserted",
  "digest.created",
] as const;

export type ProductEventName = (typeof PRODUCT_EVENT_NAMES)[number];

export type EventScalar = string | number | boolean | null;

export interface ProductEvent {
  type: ProductEventName;
  [key: string]: EventScalar | undefined;
}

const FORBIDDEN_KEY =
  /token|secret|authorization|password|api[_-]?key|refresh|email_body|thread_text|prompt|cookie|encrypted/i;

const SECRET_VALUE =
  /bearer\s+[a-z0-9._~+/=-]+|ya29\.[a-z0-9_-]+|sk-[a-z0-9]+|eyj[a-z0-9_-]+\.[a-z0-9_-]+/i;

export type EventSink = (line: string) => void;

let sink: EventSink = (line) => {
  console.info(line);
};

export function setProductEventSink(next: EventSink): void {
  sink = next;
}

export function resetProductEventSink(): void {
  sink = (line) => {
    console.info(line);
  };
}

function redactUrl(value: string): string {
  try {
    const url = new URL(value);
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return value.replace(
      /([?&](?:code|access_token|refresh_token|client_secret|key)=)[^&]+/gi,
      "$1redacted",
    );
  }
}

export function sanitizeEventValue(value: EventScalar): EventScalar {
  if (typeof value !== "string") {
    return value;
  }
  if (SECRET_VALUE.test(value) || /^(?=.*[a-f0-9])[a-f0-9]{64}$/i.test(value)) {
    return "[redacted]";
  }
  if (/^https?:\/\//i.test(value)) {
    return redactUrl(value);
  }
  return value;
}

export function sanitizeProductEvent(event: ProductEvent): Record<string, EventScalar> {
  const sanitized: Record<string, EventScalar> = {
    type: event.type,
  };
  for (const [key, value] of Object.entries(event)) {
    if (key === "type" || value === undefined) {
      continue;
    }
    if (FORBIDDEN_KEY.test(key)) {
      continue;
    }
    sanitized[key] = sanitizeEventValue(value);
  }
  return sanitized;
}

export function emitProductEvent(event: ProductEvent): void {
  const payload = {
    ts: new Date().toISOString(),
    ...sanitizeProductEvent(event),
  };
  sink(JSON.stringify(payload));
}
