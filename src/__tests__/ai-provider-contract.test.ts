import { afterEach, describe, expect, it, vi } from "vitest";
import { openaiProvider } from "../lib/ai/providers/openai";
import {
  getAIProvider,
  isAIProviderId,
  listAIProviders,
} from "../lib/ai/providers";
import { AIProviderError } from "../lib/ai/provider-contract";

function stubFetch(status: number) {
  const fetchMock = vi.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("OpenAI provider adapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("declares API key as its auth method and a default model", () => {
    expect(openaiProvider.id).toBe("openai");
    expect(openaiProvider.authMethods).toContain("api_key");
    expect(openaiProvider.defaultModel).toBe("gpt-4o");
    expect(openaiProvider.models.some((m) => m.id === openaiProvider.defaultModel && m.default)).toBe(true);
  });

  it("validates a key via a non-generating /v1/models call", async () => {
    const fetchMock = stubFetch(200);

    await expect(openaiProvider.validateApiKey("sk-valid")).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/v1/models"),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer sk-valid" }),
      }),
    );
  });

  it("classifies 401/403 as INVALID_API_KEY", async () => {
    stubFetch(401);
    await expect(openaiProvider.validateApiKey("sk-bad")).rejects.toMatchObject({
      code: "INVALID_API_KEY",
    });
  });

  it("classifies 429 as RATE_LIMITED", async () => {
    stubFetch(429);
    await expect(openaiProvider.validateApiKey("sk-limited")).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
  });

  it("classifies 5xx as PROVIDER_UNAVAILABLE", async () => {
    stubFetch(503);
    await expect(openaiProvider.validateApiKey("sk-key")).rejects.toMatchObject({
      code: "PROVIDER_UNAVAILABLE",
    });
  });

  it("classifies a network failure as NETWORK_ERROR", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    await expect(openaiProvider.validateApiKey("sk-key")).rejects.toMatchObject({
      code: "NETWORK_ERROR",
    });
  });

  it("surfaces AIProviderError instances", async () => {
    stubFetch(401);
    await expect(openaiProvider.validateApiKey("sk-bad")).rejects.toBeInstanceOf(
      AIProviderError,
    );
  });

  it("uses completion parameters supported by o-series models", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: '{"ok":true}' } }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await openaiProvider.generateStructured!("sk-valid", {
      model: "o3-mini",
      systemPrompt: "system",
      userPrompt: "user",
      maxOutputTokens: 6000,
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>;
    expect(body).toMatchObject({ model: "o3-mini", max_completion_tokens: 6000 });
    expect(body).not.toHaveProperty("max_tokens");
    expect(body).not.toHaveProperty("temperature");
  });
});

describe("provider registry", () => {
  it("resolves the OpenAI adapter and lists it", () => {
    expect(getAIProvider("openai")).toBeDefined();
    expect(listAIProviders().map((p) => p.id)).toContain("openai");
  });

  it("resolves the Anthropic adapter alongside OpenAI", () => {
    expect(getAIProvider("anthropic")).toBeDefined();
    expect(listAIProviders().map((p) => p.id)).toEqual(
      expect.arrayContaining(["openai", "anthropic"]),
    );
  });

  it("recognizes only known provider ids", () => {
    expect(isAIProviderId("openai")).toBe(true);
    expect(isAIProviderId("anthropic")).toBe(true);
    expect(isAIProviderId("google")).toBe(false);
    expect(isAIProviderId(undefined)).toBe(false);
  });
});
