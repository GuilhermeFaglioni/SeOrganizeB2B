import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { opencodeProvider } from "../lib/ai/providers/opencode";
import {
  getAIProvider,
  isAIProviderId,
  listAIProviders,
} from "../lib/ai/providers";

const originalBaseUrl = process.env.OPENCODE_API_BASE_URL;

function requestBody(
  fetchMock: ReturnType<typeof vi.fn>,
  callIndex = 0,
): Record<string, unknown> {
  const [, init] = fetchMock.mock.calls[callIndex] as [string, RequestInit];
  return JSON.parse(init.body as string) as Record<string, unknown>;
}

describe("OpenCode Zen provider adapter", () => {
  beforeEach(() => {
    process.env.OPENCODE_API_BASE_URL = "https://zen.example.test";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalBaseUrl === undefined) delete process.env.OPENCODE_API_BASE_URL;
    else process.env.OPENCODE_API_BASE_URL = originalBaseUrl;
  });

  it("declares the current OpenAI-compatible catalog without unsupported vision claims", () => {
    expect(opencodeProvider.id).toBe("opencode");
    expect(opencodeProvider.name).toBe("OpenCode Zen");
    expect(opencodeProvider.authMethods).toEqual(["api_key"]);
    expect(opencodeProvider.defaultModel).toBe("deepseek-v4-flash");
    expect(opencodeProvider.models).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "deepseek-v4-flash", default: true }),
        expect.objectContaining({ id: "deepseek-v4-pro" }),
        expect.objectContaining({ id: "glm-5.2" }),
      ]),
    );
    expect(
      opencodeProvider.models.every(
        (model) => !model.vision && model.streaming,
      ),
    ).toBe(true);
    expect(opencodeProvider.models.some((model) => model.id === "glm-5")).toBe(
      false,
    );
    expect(
      opencodeProvider.models.some((model) => model.id.endsWith("-free")),
    ).toBe(false);
  });

  it("validates an API key through an authenticated minimal completion", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ id: "deepseek-v4-pro" }] }),
      })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      opencodeProvider.validateApiKey("zen-secret", "deepseek-v4-pro"),
    ).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://zen.example.test/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer zen-secret",
        }),
      }),
    );
    expect(requestBody(fetchMock, 1)).toMatchObject({
      model: "deepseek-v4-pro",
      max_tokens: 1,
      stream: false,
    });
    expect(JSON.stringify(requestBody(fetchMock, 1))).not.toContain(
      "zen-secret",
    );
  });

  it("classifies a rejected authenticated completion as an invalid API key", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ id: "deepseek-v4-flash" }] }),
      })
      .mockResolvedValueOnce({ ok: false, status: 401 });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      opencodeProvider.validateApiKey("zen-secret"),
    ).rejects.toMatchObject({
      code: "INVALID_API_KEY",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://zen.example.test/v1/chat/completions",
      expect.anything(),
    );
  });

  it("does not classify Zen credits or model errors as invalid API keys", async () => {
    for (const errorType of [
      "CreditsError",
      "MonthlyLimitError",
      "UserLimitError",
    ]) {
      const validationFetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ data: [{ id: "deepseek-v4-flash" }] }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({ type: "error", error: { type: errorType } }),
        });
      vi.stubGlobal("fetch", validationFetch);

      await expect(
        opencodeProvider.validateApiKey("zen-secret"),
      ).rejects.toMatchObject({
        code: "UNKNOWN",
      });
    }

    const generationFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ type: "error", error: { type: "ModelError" } }),
    });
    vi.stubGlobal("fetch", generationFetch);

    await expect(
      opencodeProvider.generateStructured!("zen-secret", {
        model: "deepseek-v4-flash",
        systemPrompt: "system",
        userPrompt: "user",
        maxOutputTokens: 6000,
      }),
    ).rejects.toMatchObject({ code: "UNKNOWN" });
  });

  it("preserves safe upstream diagnostics for generation failures", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ type: "error", error: { type: "CreditsError" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      opencodeProvider.generateStructured!("zen-secret", {
        model: "deepseek-v4-flash",
        systemPrompt: "system",
        userPrompt: "user",
        maxOutputTokens: 6000,
      }),
    ).rejects.toMatchObject({
      code: "UNKNOWN",
      providerStatus: 403,
      providerErrorType: "CreditsError",
    });
  });

  it("probes an available paid model when re-validating without a selected model", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ id: "deepseek-v4-pro" }] }),
      })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      opencodeProvider.validateApiKey("zen-secret"),
    ).resolves.toBeUndefined();

    expect(requestBody(fetchMock, 1)).toMatchObject({
      model: "deepseek-v4-pro",
      max_tokens: 1,
    });
  });

  it("rejects a key when its selected model is disabled without generating", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ id: "deepseek-v4-flash" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      opencodeProvider.validateApiKey("zen-secret", "deepseek-v4-pro"),
    ).rejects.toMatchObject({ code: "UNKNOWN" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("uses the authenticated model list to filter disabled models", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          { id: "deepseek-v4-flash" },
          { id: "deepseek-v4-pro" },
          { id: "big-pickle" },
          { id: "responses-only-model" },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const models = await opencodeProvider.listAvailableModels!("zen-secret");

    expect(models.map((model) => model.id)).toEqual([
      "deepseek-v4-flash",
      "deepseek-v4-pro",
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://zen.example.test/v1/models",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer zen-secret",
        }),
      }),
    );
  });

  it("sends a text-only OpenAI-compatible request without claiming response_format support", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: '{"html":"<p>ok</p>"}' } }],
        usage: { prompt_tokens: 5, completion_tokens: 3 },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await opencodeProvider.generateStructured!("zen-secret", {
      model: "deepseek-v4-flash",
      systemPrompt: "system",
      userPrompt: "user",
      maxOutputTokens: 6000,
    });

    expect(result).toEqual({
      text: '{"html":"<p>ok</p>"}',
      inputTokens: 5,
      outputTokens: 3,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://zen.example.test/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer zen-secret",
          Accept: "application/json",
        }),
      }),
    );
    const body = requestBody(fetchMock);
    expect(body).toMatchObject({
      model: "deepseek-v4-flash",
      max_tokens: 6000,
      stream: false,
    });
    expect(body).not.toHaveProperty("response_format");
    expect(JSON.stringify(body)).not.toContain("zen-secret");
  });

  it("reads OpenAI-compatible SSE deltas", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: new Response(
        'data: {"choices":[{"delta":{"content":"{\\"html\\":\\"<p>"}}]}\n\n' +
          'data: {"choices":[{"delta":{"content":"ok</p>\\"}"}}]}\n\n' +
          "data: [DONE]\n\n",
      ).body,
    });
    vi.stubGlobal("fetch", fetchMock);

    const deltas: string[] = [];
    for await (const delta of opencodeProvider.generateStructuredStream!(
      "zen-secret",
      {
        model: "deepseek-v4-flash",
        systemPrompt: "system",
        userPrompt: "user",
        maxOutputTokens: 6000,
      },
    )) {
      deltas.push(delta);
    }

    expect(deltas).toEqual(['{"html":"<p>', 'ok</p>"}']);
    expect(requestBody(fetchMock)).toMatchObject({
      model: "deepseek-v4-flash",
      stream: true,
    });
  });

  it("does not send image bytes to a text-only model family", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      opencodeProvider.generateStructured!("zen-secret", {
        model: "deepseek-v4-flash",
        systemPrompt: "system",
        userPrompt: "user",
        maxOutputTokens: 6000,
        images: [
          {
            id: "image-1",
            fileName: "reference.png",
            format: "png",
            width: 1,
            height: 1,
            sizeBytes: 1,
            data: Buffer.from("secret-image"),
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "UNKNOWN" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("OpenCode Zen provider registry", () => {
  it("resolves and recognizes the provider without removing existing providers", () => {
    expect(getAIProvider("opencode")).toBe(opencodeProvider);
    expect(isAIProviderId("opencode")).toBe(true);
    expect(listAIProviders().map((provider) => provider.id)).toEqual(
      expect.arrayContaining([
        "openai",
        "anthropic",
        "opencode",
        "opencode-go",
      ]),
    );
  });
});
