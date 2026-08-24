import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { opencodeGoProvider } from "../lib/ai/providers/opencode-go";

const originalBaseUrl = process.env.OPENCODE_GO_API_BASE_URL;

function requestBody(fetchMock: ReturnType<typeof vi.fn>, callIndex = 0): Record<string, unknown> {
  const [, init] = fetchMock.mock.calls[callIndex] as [string, RequestInit];
  return JSON.parse(init.body as string) as Record<string, unknown>;
}

describe("OpenCode Go provider adapter", () => {
  beforeEach(() => {
    process.env.OPENCODE_GO_API_BASE_URL = "https://go.example.test";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalBaseUrl === undefined) delete process.env.OPENCODE_GO_API_BASE_URL;
    else process.env.OPENCODE_GO_API_BASE_URL = originalBaseUrl;
  });

  it("exposes only the paid documented chat-compatible models", () => {
    expect(opencodeGoProvider.id).toBe("opencode-go");
    expect(opencodeGoProvider.name).toBe("OpenCode Go");
    expect(opencodeGoProvider.defaultModel).toBe("deepseek-v4-flash");
    expect(opencodeGoProvider.models.map((model) => model.id)).toEqual([
      "glm-5.3",
      "glm-5.2",
      "glm-5.1",
      "kimi-k3",
      "kimi-k2.7-code",
      "kimi-k2.6",
      "deepseek-v4-pro",
      "deepseek-v4-flash",
      "mimo-v2.5",
      "mimo-v2.5-pro",
      "hy3",
    ]);
    expect(opencodeGoProvider.models.every((model) => model.streaming && !model.vision)).toBe(true);
    expect(opencodeGoProvider.models.some((model) => model.id.endsWith("-free"))).toBe(false);
    expect(opencodeGoProvider.models.some((model) => model.id.includes("vision"))).toBe(false);
  });

  it("validates the shared API key with a minimal authenticated Go completion", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ id: "glm-5.3" }] }),
      })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    await expect(opencodeGoProvider.validateApiKey("shared-key", "glm-5.3")).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://go.example.test/v1/models",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer shared-key" }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://go.example.test/v1/chat/completions",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer shared-key" }),
      }),
    );
    expect(requestBody(fetchMock, 1)).toMatchObject({
      model: "glm-5.3",
      max_tokens: 1,
      stream: false,
    });
    expect(JSON.stringify(requestBody(fetchMock, 1))).not.toContain("shared-key");
  });

  it("generates through the Go chat endpoint without unsupported response_format or images", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: '{"html":"<p>go</p>"}' } }],
        usage: { prompt_tokens: 7, completion_tokens: 4 },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await opencodeGoProvider.generateStructured!("shared-key", {
      model: "mimo-v2.5-pro",
      systemPrompt: "system",
      userPrompt: "user",
      maxOutputTokens: 6000,
    });

    expect(result).toEqual({
      text: '{"html":"<p>go</p>"}',
      inputTokens: 7,
      outputTokens: 4,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://go.example.test/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer shared-key",
          Accept: "application/json",
        }),
      }),
    );
    const body = requestBody(fetchMock);
    expect(body).toMatchObject({ model: "mimo-v2.5-pro", max_tokens: 6000, stream: false });
    expect(body).not.toHaveProperty("response_format");
    expect(JSON.stringify(body)).not.toContain("shared-key");
  });

  it("does not mislabel Go account limits or model errors as invalid keys", async () => {
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
        json: async () => ({ type: "error", error: { type: "GoUsageLimitError" } }),
      });
    vi.stubGlobal("fetch", validationFetch);

    await expect(opencodeGoProvider.validateApiKey("shared-key")).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });

    const generationFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ type: "error", error: { type: "ModelError" } }),
    });
    vi.stubGlobal("fetch", generationFetch);

    await expect(
      opencodeGoProvider.generateStructured!("shared-key", {
        model: "deepseek-v4-flash",
        systemPrompt: "system",
        userPrompt: "user",
        maxOutputTokens: 6000,
      }),
    ).rejects.toMatchObject({ code: "UNKNOWN" });
  });
});
