import type { AIProviderModel } from "../provider-contract";
import { createOpenCodeCompatibleProvider } from "./opencode-compatible";

// Zen currently exposes these models through its OpenAI-compatible endpoint.
// Models served through the Responses, Anthropic, or Google endpoints are not
// silently routed through this adapter.
const OPENCODE_MODELS: AIProviderModel[] = [
  { id: "deepseek-v4-flash", vision: false, streaming: true, default: true },
  { id: "deepseek-v4-pro", vision: false, streaming: true, default: false },
  { id: "minimax-m3", vision: false, streaming: true, default: false },
  { id: "minimax-m2.7", vision: false, streaming: true, default: false },
  { id: "glm-5.2", vision: false, streaming: true, default: false },
  { id: "glm-5.1", vision: false, streaming: true, default: false },
  { id: "kimi-k3", vision: false, streaming: true, default: false },
  { id: "kimi-k2.7-code", vision: false, streaming: true, default: false },
  { id: "kimi-k2.6", vision: false, streaming: true, default: false },
];

export const opencodeProvider = createOpenCodeCompatibleProvider({
  id: "opencode",
  name: "OpenCode Zen",
  baseUrlEnv: "OPENCODE_API_BASE_URL",
  defaultBaseUrl: "https://opencode.ai/zen",
  defaultModel: "deepseek-v4-flash",
  models: OPENCODE_MODELS,
});
