import type { AIProviderModel } from "../provider-contract";
import { createOpenCodeCompatibleProvider } from "./opencode-compatible";

// Go's Responses and Anthropic models stay out of this initial adapter. Every
// listed model is documented for /v1/chat/completions and has no training use.
const OPENCODE_GO_MODELS: AIProviderModel[] = [
  { id: "glm-5.3", vision: false, streaming: true, default: false },
  { id: "glm-5.2", vision: false, streaming: true, default: false },
  { id: "glm-5.1", vision: false, streaming: true, default: false },
  { id: "kimi-k3", vision: false, streaming: true, default: false },
  { id: "kimi-k2.7-code", vision: false, streaming: true, default: false },
  { id: "kimi-k2.6", vision: false, streaming: true, default: false },
  { id: "deepseek-v4-pro", vision: false, streaming: true, default: false },
  { id: "deepseek-v4-flash", vision: false, streaming: true, default: true },
  { id: "mimo-v2.5", vision: false, streaming: true, default: false },
  { id: "mimo-v2.5-pro", vision: false, streaming: true, default: false },
  { id: "hy3", vision: false, streaming: true, default: false },
];

export const opencodeGoProvider = createOpenCodeCompatibleProvider({
  id: "opencode-go",
  name: "OpenCode Go",
  baseUrlEnv: "OPENCODE_GO_API_BASE_URL",
  defaultBaseUrl: "https://opencode.ai/zen/go",
  defaultModel: "deepseek-v4-flash",
  models: OPENCODE_GO_MODELS,
});
