import {
  AIProviderError,
  type AIProviderErrorCode,
} from "../provider-contract";

export function errorCodeForStatus(status: number): AIProviderErrorCode {
  if (status === 401 || status === 403) return "INVALID_API_KEY";
  if (status === 408 || status === 504) return "TIMEOUT";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 500) return "PROVIDER_UNAVAILABLE";
  return "UNKNOWN";
}

export function errorMessageForStatus(
  providerName: string,
  code: AIProviderErrorCode,
): string {
  switch (code) {
    case "INVALID_API_KEY":
      return `${providerName} rejected the API key. Check that it is valid and active.`;
    case "RATE_LIMITED":
      return `${providerName} rate limited this request. Try again later or choose another connected model.`;
    case "TIMEOUT":
      return `${providerName} did not respond before the generation timeout.`;
    case "PROVIDER_UNAVAILABLE":
      return `${providerName} is temporarily unavailable. Try again later.`;
    default:
      return `${providerName} could not complete the generation. Try again later.`;
  }
}

export async function readProviderError(
  response: Response,
  providerName: string,
): Promise<never> {
  const code = errorCodeForStatus(response.status);
  throw new AIProviderError(code, errorMessageForStatus(providerName, code));
}

export function parseTextContent(value: unknown): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object" && "text" in part) {
        const text = (part as { text?: unknown }).text;
        return typeof text === "string" ? text : "";
      }
      return "";
    })
    .join("");
}

export async function* readSseText(
  response: Response,
  extract: (event: Record<string, unknown>) => string | undefined,
): AsyncGenerator<string> {
  if (!response.body) {
    throw new AIProviderError(
      "INVALID_RESPONSE",
      "The provider returned an empty streaming response.",
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() ?? "";

      for (const event of events) {
        const data = event
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trim())
          .join("");
        if (!data || data === "[DONE]") continue;
        try {
          const parsed = JSON.parse(data) as Record<string, unknown>;
          const text = extract(parsed);
          if (text) yield text;
        } catch {
          throw new AIProviderError(
            "INVALID_RESPONSE",
            "The provider returned invalid streaming data.",
          );
        }
      }

      if (done) break;
    }

    if (buffer.trim()) {
      const data = buffer
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("");
      if (data && data !== "[DONE]") {
        try {
          const parsed = JSON.parse(data) as Record<string, unknown>;
          const text = extract(parsed);
          if (text) yield text;
        } catch {
          throw new AIProviderError(
            "INVALID_RESPONSE",
            "The provider returned invalid streaming data.",
          );
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
