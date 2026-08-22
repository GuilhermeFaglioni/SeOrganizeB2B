import type { AIStudioImageAsset } from "./studio-contract";

export type AIProviderId = "openai" | "anthropic";

export type AIAuthMethod = "api_key" | "oauth";
export type AIProviderOAuthStatus = "unsupported" | "requires_setup" | "supported";
export interface AIProviderOAuthCapability {
  status: AIProviderOAuthStatus;
  reasonKey: string;
}

export type AIProviderErrorCode =
  | "INVALID_API_KEY"
  | "RATE_LIMITED"
  | "PROVIDER_UNAVAILABLE"
  | "NETWORK_ERROR"
  | "TIMEOUT"
  | "INVALID_RESPONSE"
  | "UNKNOWN";

/**
 * Normalized error thrown by provider adapters. `code` is a machine-readable
 * category the platform can surface as an actionable error; `message` is safe
 * for client display and never includes the secret.
 */
export class AIProviderError extends Error {
  readonly code: AIProviderErrorCode;

  constructor(code: AIProviderErrorCode, message: string) {
    super(message);
    this.name = "AIProviderError";
    this.code = code;
  }
}

export interface AIProviderModel {
  id: string;
  vision: boolean;
  streaming: boolean;
  default: boolean;
}

export interface AIProviderGenerationRequest {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  maxOutputTokens: number;
  signal?: AbortSignal;
  images?: AIStudioImageAsset[];
}

export interface AIProviderGenerationResult {
  text: string;
  inputTokens?: number;
  outputTokens?: number;
}

/**
 * The single contract the AI Studio (and connection management) builds against.
 * Provider-specific behavior is isolated behind adapters implementing this
 * interface; adding or disabling a provider never rewrites the caller.
 */
export interface AIProvider {
  readonly id: AIProviderId;
  readonly name: string;
  readonly authMethods: AIAuthMethod[];
  readonly oauth: AIProviderOAuthCapability;
  readonly defaultModel: string;
  readonly models: AIProviderModel[];
  validateApiKey(apiKey: string): Promise<void>;
  /**
   * Generates the provider-neutral JSON contract used by AI Studio. Optional
   * keeps connection-only adapters backwards compatible while the generation
   * capability is rolled out behind the studio service.
   */
  generateStructured?: (
    apiKey: string,
    request: AIProviderGenerationRequest,
  ) => Promise<AIProviderGenerationResult>;
  /**
   * Emits provider text deltas. Deltas are display-only; AI Studio validates
   * the complete response before exposing HTML to preview or persistence.
   */
  generateStructuredStream?: (
    apiKey: string,
    request: AIProviderGenerationRequest,
  ) => AsyncIterable<string>;
}
