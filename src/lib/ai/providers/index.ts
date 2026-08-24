import { openaiProvider } from "./openai";
import { anthropicProvider } from "./anthropic";
import { opencodeProvider } from "./opencode";
import { opencodeGoProvider } from "./opencode-go";
import type { AIProvider, AIProviderId } from "../provider-contract";

const providers: Partial<Record<AIProviderId, AIProvider>> = {
  openai: openaiProvider,
  anthropic: anthropicProvider,
  opencode: opencodeProvider,
  "opencode-go": opencodeGoProvider,
};

export function isAIProviderId(value: unknown): value is AIProviderId {
  return (
    value === "openai" ||
    value === "anthropic" ||
    value === "opencode" ||
    value === "opencode-go"
  );
}

export function getAIProvider(id: AIProviderId): AIProvider | undefined {
  return providers[id];
}

export function listAIProviders(): AIProvider[] {
  return Object.values(providers).filter(
    (provider): provider is AIProvider => provider !== undefined,
  );
}
