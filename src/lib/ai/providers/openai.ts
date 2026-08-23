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
  readProviderError,
  readSseText,
} from "./transport";

const OPENAI_MODELS: AIProviderModel[] = [
  { id: "gpt-4o", vision: true, streaming: true, default: true },
  { id: "gpt-4o-mini", vision: true, streaming: true, default: false },
  { id: "gpt-4.1", vision: true, streaming: true, default: false },
  { id: "gpt-4.1-mini", vision: true, streaming: true, default: false },
  { id: "o3-mini", vision: false, streaming: true, default: false },
];

const DEFAULT_BASE_URL = "https://api.openai.com";

function baseUrl(): string {
  return process.env.OPENAI_API_BASE_URL?.replace(/\/$/, "") ?? DEFAULT_BASE_URL;
}

function imageContentParts(images: AIStudioImageAsset[] | undefined, userPrompt: string) {
  if (!images || images.length === 0) return undefined;
  const parts: Array<Record<string, unknown>> = images.map((image) => ({
    type: "image_url",
    image_url: {
      url: `data:${image.format === "jpeg" ? "image/jpeg" : `image/${image.format}`};base64,${image.data.toString("base64")}`,
    },
  }));
  return [{ type: "text", text: userPrompt }, ...parts];
}

function generationBody(request: {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  maxOutputTokens: number;
  stream: boolean;
  images?: AIStudioImageAsset[];
}) {
  const isReasoningModel = /^o\d/i.test(request.model);
  const imageParts = imageContentParts(request.images, request.userPrompt);
  return {
    model: request.model,
    messages: [
      { role: "system", content: request.systemPrompt },
      {
        role: "user",
        ...(imageParts
          ? { content: imageParts }
          : { content: request.userPrompt }),
      },
    ],
    response_format: { type: "json_object" },
    stream: request.stream,
    ...(isReasoningModel
      ? { max_completion_tokens: request.maxOutputTokens }
      : { max_tokens: request.maxOutputTokens, temperature: 0.3 }),
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
    return await fetch(`${baseUrl()}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(generationBody({ ...request, stream })),
      signal: request.signal,
    });
  } catch {
    if (request.signal?.aborted) {
      throw new AIProviderError("TIMEOUT", "OpenAI generation timed out.");
    }
    throw new AIProviderError(
      "NETWORK_ERROR",
      "Could not reach OpenAI. Check your connection and try again.",
    );
  }
}

/**
 * OpenAI provider adapter. Connection validation is a read-only, non-generating
 * call to `GET /v1/models`, so validating a key never spends a real generation.
 */
export const openaiProvider: AIProvider = {
  id: "openai",
  name: "OpenAI",
  authMethods: ["api_key"],
  oauth: {
    status: "unsupported",
    reasonKey: "oauthUnavailableOAuthConditionNotMet",
  },
  defaultModel: "gpt-4o",
  models: OPENAI_MODELS,

  async validateApiKey(apiKey: string): Promise<void> {
    let response: Response;
    try {
      response = await fetch(`${baseUrl()}/v1/models`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new AIProviderError(
        "NETWORK_ERROR",
        "Could not reach OpenAI. Check your connection and try again.",
      );
    }

    if (response.ok) return;

    const code = errorCodeForStatus(response.status);
    const message =
      code === "INVALID_API_KEY"
        ? "OpenAI rejected the API key. Check that it is valid and active."
        : code === "RATE_LIMITED"
          ? "OpenAI rate limited this request. Try again later."
          : "OpenAI could not validate the key right now. Try again later.";

    throw new AIProviderError(code, message);
  },

  async generateStructured(apiKey, request) {
    const response = await generationResponse(apiKey, request, false);
    if (!response.ok) await readProviderError(response, "OpenAI");

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new AIProviderError(
        "INVALID_RESPONSE",
        "OpenAI returned an invalid generation response.",
      );
    }
    const root = payload as {
      choices?: Array<{ message?: { content?: unknown } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const text = parseTextContent(root.choices?.[0]?.message?.content);
    if (!text.trim()) {
      throw new AIProviderError(
        "INVALID_RESPONSE",
        "OpenAI returned an empty generation response.",
      );
    }
    return {
      text,
      inputTokens: root.usage?.prompt_tokens,
      outputTokens: root.usage?.completion_tokens,
    };
  },

  async *generateStructuredStream(apiKey, request) {
    const response = await generationResponse(apiKey, request, true);
    if (!response.ok) {
      const code = errorCodeForStatus(response.status);
      throw new AIProviderError(code, errorMessageForStatus("OpenAI", code));
    }
    yield* readSseText(response, (event) => {
      const choices = event.choices;
      if (!Array.isArray(choices)) return undefined;
      const delta = choices[0] && typeof choices[0] === "object"
        ? (choices[0] as { delta?: { content?: unknown } }).delta
        : undefined;
      return parseTextContent(delta?.content);
    });
  },
};
