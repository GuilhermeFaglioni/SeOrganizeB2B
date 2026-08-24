import {
  AIProviderError,
  type AIProvider,
  type AIProviderModel,
} from "../provider-contract";
import type { AIStudioImageAsset } from "../studio-contract";
import {
  errorCodeForStatus,
  errorMessageForStatus,
  parseTextContent,
  readSseText,
  readProviderError,
} from "./transport";

const ANTHROPIC_MODELS: AIProviderModel[] = [
  { id: "claude-sonnet-4-5", vision: true, streaming: true, default: true },
  { id: "claude-opus-4-1", vision: true, streaming: true, default: false },
  { id: "claude-haiku-4-5", vision: true, streaming: true, default: false },
  { id: "claude-sonnet-4", vision: true, streaming: true, default: false },
];

const DEFAULT_BASE_URL = "https://api.anthropic.com";

function baseUrl(): string {
  return process.env.ANTHROPIC_API_BASE_URL?.replace(/\/$/, "") ?? DEFAULT_BASE_URL;
}

function userContent(request: { userPrompt: string; images?: AIStudioImageAsset[] }) {
  if (!request.images || request.images.length === 0) return request.userPrompt;
  return [
    { type: "text", text: request.userPrompt },
    ...request.images.map((image) => ({
      type: "image",
      source: {
        type: "base64",
        media_type: image.format === "jpeg" ? "image/jpeg" : `image/${image.format}`,
        data: image.data.toString("base64"),
      },
    })),
  ];
}

function generationBody(request: {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  maxOutputTokens: number;
  stream: boolean;
  images?: AIStudioImageAsset[];
}) {
  return {
    model: request.model,
    system: request.systemPrompt,
    max_tokens: request.maxOutputTokens,
    temperature: 0.3,
    stream: request.stream,
    messages: [{ role: "user", content: userContent(request) }],
  };
}

async function generationResponse(
  apiKey: string,
  request: {
    model: string;
    systemPrompt: string;
    userPrompt: string;
    maxOutputTokens: number;
    signal?: AbortSignal;
    images?: AIStudioImageAsset[];
  },
  stream: boolean,
): Promise<Response> {
  try {
    return await fetch(`${baseUrl()}/v1/messages`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(generationBody({ ...request, stream })),
      signal: request.signal,
    });
  } catch {
    if (request.signal?.aborted) {
      throw new AIProviderError("TIMEOUT", "Anthropic generation timed out.");
    }
    throw new AIProviderError(
      "NETWORK_ERROR",
      "Could not reach Anthropic. Check your connection and try again.",
    );
  }
}

/**
 * Anthropic provider adapter. Connection validation is a read-only,
 * non-generating call to `GET /v1/models`, so validating a key never spends a
 * real generation. Anthropic authenticates with the `x-api-key` header (plus
 * the required `anthropic-version`) instead of a `Bearer` token.
 */
export const anthropicProvider: AIProvider = {
  id: "anthropic",
  name: "Anthropic",
  authMethods: ["api_key"],
  oauth: {
    status: "unsupported",
    reasonKey: "oauthUnavailableClaudeThirdParty",
  },
  defaultModel: "claude-sonnet-4-5",
  models: ANTHROPIC_MODELS,

  async validateApiKey(apiKey: string): Promise<void> {
    let response: Response;
    try {
      response = await fetch(`${baseUrl()}/v1/models`, {
        method: "GET",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new AIProviderError(
        "NETWORK_ERROR",
        "Could not reach Anthropic. Check your connection and try again.",
      );
    }

    if (response.ok) return;

    const code = errorCodeForStatus(response.status);
    const message =
      code === "INVALID_API_KEY"
        ? "Anthropic rejected the API key. Check that it is valid and active."
        : code === "RATE_LIMITED"
          ? "Anthropic rate limited this request. Try again later."
          : "Anthropic could not validate the key right now. Try again later.";

    throw new AIProviderError(code, message);
  },

  async generateStructured(apiKey, request) {
    const response = await generationResponse(apiKey, request, false);
    if (!response.ok) await readProviderError(response, "Anthropic");

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new AIProviderError(
        "INVALID_RESPONSE",
        "Anthropic returned an invalid generation response.",
      );
    }
    const root = payload as {
      content?: unknown;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const text = parseTextContent(root.content);
    if (!text.trim()) {
      throw new AIProviderError(
        "INVALID_RESPONSE",
        "Anthropic returned an empty generation response.",
      );
    }
    return {
      text,
      inputTokens: root.usage?.input_tokens,
      outputTokens: root.usage?.output_tokens,
    };
  },

  async *generateStructuredStream(apiKey, request) {
    const response = await generationResponse(apiKey, request, true);
    if (!response.ok) {
      const code = errorCodeForStatus(response.status);
      throw new AIProviderError(code, errorMessageForStatus("Anthropic", code));
    }
    yield* readSseText(response, (event) => {
      const delta = event.delta;
      if (!delta || typeof delta !== "object") return undefined;
      return parseTextContent((delta as { text?: unknown }).text);
    });
  },
};
