import {
  AIProviderError,
  type AIProvider,
  type AIProviderGenerationRequest,
  type AIProviderId,
  type AIProviderModel,
} from "../provider-contract";
import { errorCodeForStatus, parseTextContent, readSseText } from "./transport";

const VALIDATION_PROMPT = "Reply with OK.";

export interface OpenCodeCompatibleProviderConfig {
  id: AIProviderId;
  name: string;
  baseUrlEnv: string;
  defaultBaseUrl: string;
  defaultModel: string;
  models: AIProviderModel[];
}

type GenerationRequest = Pick<
  AIProviderGenerationRequest,
  "model" | "systemPrompt" | "userPrompt" | "maxOutputTokens" | "images"
> & { stream: boolean };

function errorType(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const root = payload as {
    type?: unknown;
    error?: { type?: unknown };
  };
  if (typeof root.error?.type === "string") return root.error.type;
  return typeof root.type === "string" ? root.type : undefined;
}

function errorCode(status: number, type: string | undefined) {
  if (type === "AuthError") return "INVALID_API_KEY" as const;
  if (
    type === "RateLimitError" ||
    type === "FreeUsageLimitError" ||
    type === "GoUsageLimitError" ||
    type === "BlackUsageLimitError"
  ) {
    return "RATE_LIMITED" as const;
  }
  if (
    type === "CreditsError" ||
    type === "MonthlyLimitError" ||
    type === "UserLimitError" ||
    type === "ModelError" ||
    type === "RegionError" ||
    type === "DataPolicyError"
  ) {
    return "UNKNOWN" as const;
  }
  // OpenCode uses 403 for region and data-policy failures as well as auth
  // failures, so an unknown 403 must not be presented as an invalid key.
  if (status === 403) return "UNKNOWN" as const;
  return errorCodeForStatus(status);
}

function errorMessage(
  providerName: string,
  code: ReturnType<typeof errorCode>,
  phase: "validation" | "generation",
): string {
  if (code === "INVALID_API_KEY") {
    return `${providerName} rejected the API key. Check that it is valid and active.`;
  }
  if (code === "RATE_LIMITED") {
    return `${providerName} rate limited this request. Check the account limits and try again later.`;
  }
  if (code === "PROVIDER_UNAVAILABLE") {
    return `${providerName} is temporarily unavailable. Try again later.`;
  }
  if (code === "TIMEOUT") {
    return `${providerName} did not respond before the request timeout.`;
  }
  return phase === "validation"
    ? `${providerName} could not validate this connection. Check model access and billing, then try again.`
    : `${providerName} could not complete the generation. Check model access and billing, then try again.`;
}

async function providerErrorForResponse(
  response: Response,
  providerName: string,
  phase: "validation" | "generation",
): Promise<AIProviderError> {
  let type: string | undefined;
  try {
    type = errorType(await response.json());
  } catch {
    // Preserve a safe status-based fallback when the provider does not return JSON.
  }
  const code = errorCode(response.status, type);
  return new AIProviderError(code, errorMessage(providerName, code, phase));
}

export function createOpenCodeCompatibleProvider(
  config: OpenCodeCompatibleProviderConfig,
): AIProvider {
  function baseUrl(): string {
    return process.env[config.baseUrlEnv]?.replace(/\/$/, "") ?? config.defaultBaseUrl;
  }

  function generationBody(request: GenerationRequest) {
    if (request.images && request.images.length > 0) {
      throw new AIProviderError(
        "UNKNOWN",
        `${config.name} models in this integration do not support image input.`,
      );
    }

    // The OpenCode-compatible catalogs do not guarantee response_format across
    // upstream models. AI Studio requests JSON in the prompt and validates it.
    return {
      model: request.model,
      messages: [
        { role: "system", content: request.systemPrompt },
        { role: "user", content: request.userPrompt },
      ],
      max_tokens: request.maxOutputTokens,
      stream: request.stream,
    };
  }

  async function generationResponse(
    apiKey: string,
    request: AIProviderGenerationRequest,
    stream: boolean,
  ): Promise<Response> {
    const body = JSON.stringify(generationBody({ ...request, stream }));
    try {
      return await fetch(`${baseUrl()}/v1/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: stream ? "text/event-stream" : "application/json",
          "Content-Type": "application/json",
        },
        body,
        signal: request.signal,
      });
    } catch {
      if (request.signal?.aborted) {
        throw new AIProviderError("TIMEOUT", `${config.name} generation timed out.`);
      }
      throw new AIProviderError(
        "NETWORK_ERROR",
        `Could not reach ${config.name}. Check your connection and try again.`,
      );
    }
  }

  async function modelListResponse(apiKey: string): Promise<Response> {
    try {
      return await fetch(`${baseUrl()}/v1/models`, {
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
        `Could not reach ${config.name}. Check your connection and try again.`,
      );
    }
  }

  function unavailableModelError(model: string): AIProviderError {
    return new AIProviderError(
      "UNKNOWN",
      `${config.name} does not make "${model}" available for this key. Choose another model and try again.`,
    );
  }

  async function fetchAvailableModels(apiKey: string): Promise<AIProviderModel[]> {
    const response = await modelListResponse(apiKey);
    if (!response.ok) {
      throw await providerErrorForResponse(response, config.name, "validation");
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new AIProviderError(
        "INVALID_RESPONSE",
        `${config.name} returned an invalid model catalog.`,
      );
    }

    const data =
      payload && typeof payload === "object" && "data" in payload
        ? (payload as { data?: unknown }).data
        : undefined;
    if (!Array.isArray(data)) {
      throw new AIProviderError(
        "INVALID_RESPONSE",
        `${config.name} returned an invalid model catalog.`,
      );
    }

    const availableIds = new Set(
      data.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const id = (item as { id?: unknown }).id;
        return typeof id === "string" ? [id] : [];
      }),
    );
    return config.models
      .filter((model) => availableIds.has(model.id))
      .map((model) => ({
        ...model,
        default: model.id === config.defaultModel,
      }));
  }

  return {
    id: config.id,
    name: config.name,
    authMethods: ["api_key"],
    oauth: {
      status: "unsupported",
      reasonKey: "oauthUnavailableOAuthConditionNotMet",
    },
    defaultModel: config.defaultModel,
    models: config.models,

    async validateApiKey(apiKey: string, model?: string): Promise<void> {
      const availableModels = await fetchAvailableModels(apiKey);
      const probeModel = model ?? availableModels[0]?.id ?? config.defaultModel;
      if (!availableModels.some((availableModel) => availableModel.id === probeModel)) {
        throw unavailableModelError(probeModel);
      }

      const response = await generationResponse(
        apiKey,
        {
          model: probeModel,
          systemPrompt: VALIDATION_PROMPT,
          userPrompt: VALIDATION_PROMPT,
          maxOutputTokens: 1,
          signal: AbortSignal.timeout(15_000),
        },
        false,
      );
      if (!response.ok) {
        throw await providerErrorForResponse(response, config.name, "validation");
      }
    },

    async listAvailableModels(apiKey: string): Promise<AIProviderModel[]> {
      return fetchAvailableModels(apiKey);
    },

    async generateStructured(apiKey, request) {
      const response = await generationResponse(apiKey, request, false);
      if (!response.ok) {
        throw await providerErrorForResponse(response, config.name, "generation");
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new AIProviderError(
          "INVALID_RESPONSE",
          `${config.name} returned an invalid generation response.`,
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
          `${config.name} returned an empty generation response.`,
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
        throw await providerErrorForResponse(response, config.name, "generation");
      }
      yield* readSseText(response, (event) => {
        const choices = event.choices;
        if (!Array.isArray(choices)) return undefined;
        const delta =
          choices[0] && typeof choices[0] === "object"
            ? (choices[0] as { delta?: { content?: unknown } }).delta
            : undefined;
        return parseTextContent(delta?.content);
      });
    },
  };
}
