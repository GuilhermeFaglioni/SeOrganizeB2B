import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { anthropicProvider } from "../lib/ai/providers/anthropic";
import { getAIProvider, listAIProviders } from "../lib/ai/providers";
import { AIProviderError } from "../lib/ai/provider-contract";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  connectionFindFirst: vi.fn(),
  connectionCreate: vi.fn(),
  connectionUpdate: vi.fn(),
  auditCreate: vi.fn(),
  encryptAiSecret: vi.fn(),
  decryptAiSecret: vi.fn(),
  withTenant: vi.fn((_tenantId: string, fn: () => unknown) => fn()),
}));

vi.mock("@/lib/supabase/server", () => ({
  getUser: mocks.getUser,
}));

vi.mock("../../prisma/client", () => ({
  prisma: {
    aiProviderConnection: {
      findFirst: mocks.connectionFindFirst,
      create: mocks.connectionCreate,
      update: mocks.connectionUpdate,
    },
    aiProviderConnectionAudit: {
      create: mocks.auditCreate,
    },
  },
  withTenant: mocks.withTenant,
  requireTenantId: () => "tenant-1",
}));

vi.mock("../lib/ai/crypto", () => ({
  encryptAiSecret: mocks.encryptAiSecret,
  decryptAiSecret: mocks.decryptAiSecret,
}));

import { GET as catalogGET } from "../app/api/ai/providers/route";
import {
  connectApiKey,
  revokeConnection,
} from "../lib/ai/connections-service";

function stubFetch(status: number) {
  const fetchMock = vi
    .fn()
    .mockResolvedValue({ ok: status >= 200 && status < 300, status });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const publicRow = {
  id: "conn-1",
  provider: "anthropic",
  authMethod: "api_key",
  defaultModel: "claude-sonnet-4-5",
  status: "active",
  createdBy: "user-1",
  validatedAt: new Date("2026-01-01T00:00:00Z"),
  lastErrorCode: null,
  revokedAt: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

describe("Anthropic provider adapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("declares API key only (no fake OAuth) and a default model", () => {
    expect(anthropicProvider.id).toBe("anthropic");
    expect(anthropicProvider.name).toBe("Anthropic");
    expect(anthropicProvider.authMethods).toEqual(["api_key"]);
    expect(anthropicProvider.defaultModel).toBe("claude-sonnet-4-5");
    expect(
      anthropicProvider.models.some(
        (m) => m.id === anthropicProvider.defaultModel && m.default,
      ),
    ).toBe(true);
  });

  it("declares streaming and vision capabilities for every model", () => {
    for (const model of anthropicProvider.models) {
      expect(model.vision).toBe(true);
      expect(model.streaming).toBe(true);
    }
  });

  it("validates via a non-generating /v1/models call with x-api-key", async () => {
    const fetchMock = stubFetch(200);

    await expect(anthropicProvider.validateApiKey("sk-ant-valid")).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/v1/models"),
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-api-key": "sk-ant-valid",
          "anthropic-version": "2023-06-01",
        }),
      }),
    );
  });

  it("classifies 401/403 as INVALID_API_KEY", async () => {
    stubFetch(401);
    await expect(anthropicProvider.validateApiKey("sk-ant-bad")).rejects.toMatchObject({
      code: "INVALID_API_KEY",
    });
  });

  it("classifies 429 as RATE_LIMITED", async () => {
    stubFetch(429);
    await expect(anthropicProvider.validateApiKey("sk-ant-limited")).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
  });

  it("classifies 5xx as PROVIDER_UNAVAILABLE", async () => {
    stubFetch(503);
    await expect(anthropicProvider.validateApiKey("sk-ant-key")).rejects.toMatchObject({
      code: "PROVIDER_UNAVAILABLE",
    });
  });

  it("classifies a network failure as NETWORK_ERROR", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    await expect(anthropicProvider.validateApiKey("sk-ant-key")).rejects.toMatchObject({
      code: "NETWORK_ERROR",
    });
  });

  it("surfaces AIProviderError instances without exposing the key", async () => {
    stubFetch(401);
    await expect(anthropicProvider.validateApiKey("sk-ant-secret")).rejects.toBeInstanceOf(
      AIProviderError,
    );
  });
});

describe("provider registry", () => {
  it("registers Anthropic alongside OpenAI", () => {
    expect(getAIProvider("anthropic")).toBeDefined();
    expect(listAIProviders().map((p) => p.id)).toEqual(
      expect.arrayContaining(["openai", "anthropic"]),
    );
  });
});

describe("AI providers catalog endpoint", () => {
  beforeEach(() => {
    mocks.getUser.mockReset();
  });

  it("returns 401 for unauthenticated requests", async () => {
    mocks.getUser.mockResolvedValue(null);
    const res = await catalogGET();
    expect(res.status).toBe(401);
  });

  it("returns the controlled catalog with capabilities", async () => {
    mocks.getUser.mockResolvedValue({ id: "user-1" });

    const res = await catalogGET();

    expect(res.status).toBe(200);
    const json = await res.json();
    const anthropic = json.data.find((p: { id: string }) => p.id === "anthropic");
    expect(anthropic).toBeDefined();
    expect(anthropic.defaultModel).toBe("claude-sonnet-4-5");
    expect(anthropic.models.every((m: { vision: boolean }) => typeof m.vision === "boolean")).toBe(
      true,
    );
    expect(anthropic.models.every((m: { streaming: boolean }) => typeof m.streaming === "boolean")).toBe(
      true,
    );
    expect(JSON.stringify(json)).not.toContain("validateApiKey");
  });
});

describe("Anthropic connection via service", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.withTenant.mockImplementation((_tenantId: string, fn: () => unknown) => fn());
    mocks.encryptAiSecret.mockImplementation(() => "encrypted-secret-opaque");
    mocks.decryptAiSecret.mockImplementation((value: string) => value.replace(/^enc:/, ""));
    mocks.auditCreate.mockResolvedValue({ id: "audit-1" });
    stubFetch(200);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("connects Anthropic, validating via its adapter before persisting", async () => {
    mocks.connectionFindFirst.mockResolvedValue(null);
    mocks.connectionCreate.mockResolvedValue(publicRow);

    await connectApiKey("tenant-1", "user-1", {
      provider: "anthropic",
      apiKey: "sk-ant-secret",
    });

    expect(mocks.encryptAiSecret).toHaveBeenCalledWith("sk-ant-secret");
    expect(mocks.connectionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          provider: "anthropic",
          authMethod: "api_key",
          defaultModel: "claude-sonnet-4-5",
          encryptedSecret: "encrypted-secret-opaque",
        }),
      }),
    );
  });

  it("never writes the plaintext secret", async () => {
    mocks.connectionFindFirst.mockResolvedValue(null);
    mocks.connectionCreate.mockResolvedValue(publicRow);

    await connectApiKey("tenant-1", "user-1", {
      provider: "anthropic",
      apiKey: "sk-ant-secret",
    });

    const createCall = mocks.connectionCreate.mock.calls[0][0];
    expect(JSON.stringify(createCall)).not.toContain("sk-ant-secret");
  });

  it("rejects an Anthropic model that is not in the catalog", async () => {
    await expect(
      connectApiKey("tenant-1", "user-1", {
        provider: "anthropic",
        apiKey: "sk-ant-key",
        defaultModel: "claude-made-up",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    expect(mocks.connectionCreate).not.toHaveBeenCalled();
  });

  it("replaces an existing Anthropic connection instead of creating a second", async () => {
    mocks.connectionFindFirst.mockResolvedValue({ id: "conn-1" });
    mocks.connectionUpdate.mockResolvedValue({ ...publicRow, defaultModel: "claude-opus-4-1" });

    await connectApiKey("tenant-1", "user-1", {
      provider: "anthropic",
      apiKey: "sk-ant-new",
      defaultModel: "claude-opus-4-1",
    });

    expect(mocks.connectionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "conn-1" },
        data: expect.objectContaining({ provider: "anthropic", defaultModel: "claude-opus-4-1" }),
      }),
    );
    expect(mocks.connectionCreate).not.toHaveBeenCalled();
  });

  it("keeps OpenAI and Anthropic connections independent", async () => {
    mocks.connectionFindFirst.mockResolvedValue(null);
    mocks.connectionCreate.mockResolvedValue(publicRow);

    await connectApiKey("tenant-1", "user-1", { provider: "openai", apiKey: "sk-openai" });
    await connectApiKey("tenant-1", "user-1", { provider: "anthropic", apiKey: "sk-ant" });

    const providers = mocks.connectionCreate.mock.calls.map((call) => call[0].data.provider);
    expect(providers).toEqual(["openai", "anthropic"]);
  });

  it("revokes an Anthropic connection through the shared lifecycle", async () => {
    mocks.connectionFindFirst.mockResolvedValue({ id: "conn-1", status: "active" });
    mocks.connectionUpdate.mockResolvedValue({ ...publicRow, status: "revoked", revokedAt: new Date() });

    const result = await revokeConnection("tenant-1", "anthropic", "user-1");

    expect(result.status).toBe("revoked");
    expect(mocks.connectionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "revoked", encryptedSecret: null }),
      }),
    );
    expect(mocks.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "revoked" }) }),
    );
  });
});
