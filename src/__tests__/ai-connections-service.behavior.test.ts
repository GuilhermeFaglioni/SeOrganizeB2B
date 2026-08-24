import { describe, expect, it, vi, beforeEach } from "vitest";
import { AIProviderError } from "../lib/ai/provider-contract";

const mocks = vi.hoisted(() => ({
  connectionFindMany: vi.fn(),
  connectionFindFirst: vi.fn(),
  connectionUpdate: vi.fn(),
  connectionCreate: vi.fn(),
  auditCreate: vi.fn(),
  profileFindUnique: vi.fn(),
  getAIProvider: vi.fn(),
  validateApiKey: vi.fn(),
  encryptAiSecret: vi.fn(),
  decryptAiSecret: vi.fn(),
}));

vi.mock("../../prisma/client", () => ({
  prisma: {
    aiProviderConnection: {
      findMany: mocks.connectionFindMany,
      findFirst: mocks.connectionFindFirst,
      update: mocks.connectionUpdate,
      create: mocks.connectionCreate,
    },
    aiProviderConnectionAudit: {
      create: mocks.auditCreate,
    },
    profile: {
      findUnique: mocks.profileFindUnique,
    },
  },
  withTenant: (_tenantId: string, fn: () => unknown) => fn(),
  withTenantBypass: (fn: () => unknown) => fn(),
  requireTenantId: () => "tenant-1",
}));

vi.mock("../lib/ai/crypto", async (importOriginal) => {
  const original = await importOriginal<typeof import("../lib/ai/crypto")>();
  return {
    ...original,
    encryptAiSecret: mocks.encryptAiSecret,
    decryptAiSecret: mocks.decryptAiSecret,
  };
});

vi.mock("../lib/ai/providers", async (importOriginal) => {
  const original = await importOriginal<typeof import("../lib/ai/providers")>();
  return {
    ...original,
    getAIProvider: mocks.getAIProvider,
  };
});

import {
  connectApiKey,
  listConnections,
  reconcileOrphanedConnections,
  revokeConnection,
  validateConnection,
  AiConnectionError,
} from "../lib/ai/connections-service";
import { mapAiConnectionError } from "../lib/ai/http";
import { AiSecretCryptoError } from "../lib/ai/crypto";
import { isValidPermission, allScopedPermissions, permissionKey } from "../lib/authz/permissions";

const openaiProvider = () => ({
  id: "openai",
  name: "OpenAI",
  authMethods: ["api_key"],
  defaultModel: "gpt-4o",
  models: [
    { id: "gpt-4o", vision: true, streaming: true, default: true },
    { id: "gpt-4o-mini", vision: true, streaming: true, default: false },
  ],
  validateApiKey: mocks.validateApiKey,
});

const publicRow = {
  id: "conn-1",
  provider: "openai",
  authMethod: "api_key",
  defaultModel: "gpt-4o",
  status: "active",
  createdBy: "user-1",
  validatedAt: new Date("2026-01-01T00:00:00Z"),
  lastErrorCode: null,
  revokedAt: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

describe("AI connections service", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.getAIProvider.mockReturnValue(openaiProvider());
    mocks.encryptAiSecret.mockImplementation(() => "encrypted-secret-opaque");
    mocks.decryptAiSecret.mockImplementation((value: string) => value.replace(/^enc:/, ""));
    mocks.auditCreate.mockResolvedValue({ id: "audit-1" });
  });

  describe("connectApiKey", () => {
    it("validates the key before persisting anything", async () => {
      mocks.connectionFindFirst.mockResolvedValue(null);
      mocks.connectionCreate.mockResolvedValue(publicRow);

      await connectApiKey("tenant-1", "user-1", {
        provider: "openai",
        apiKey: "sk-secret",
      });

      expect(mocks.validateApiKey).toHaveBeenCalledWith("sk-secret", "gpt-4o");
      expect(mocks.encryptAiSecret).toHaveBeenCalledWith("sk-secret");
      expect(mocks.connectionCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            encryptedSecret: "encrypted-secret-opaque",
            status: "active",
            createdBy: "user-1",
          }),
        }),
      );
    });

    it("never writes the plaintext secret", async () => {
      mocks.connectionFindFirst.mockResolvedValue(null);
      mocks.connectionCreate.mockResolvedValue(publicRow);

      await connectApiKey("tenant-1", "user-1", { provider: "openai", apiKey: "sk-secret" });

      const createCall = mocks.connectionCreate.mock.calls[0][0];
      expect(JSON.stringify(createCall)).not.toContain("sk-secret");
      expect(createCall.data.encryptedSecret).toBe("encrypted-secret-opaque");
    });

    it("preserves the existing connection when validation fails", async () => {
      mocks.connectionFindFirst.mockResolvedValue({ id: "conn-1" });
      mocks.validateApiKey.mockRejectedValue(
        new AIProviderError("INVALID_API_KEY", "OpenAI rejected the API key."),
      );

      await expect(
        connectApiKey("tenant-1", "user-1", { provider: "openai", apiKey: "sk-bad" }),
      ).rejects.toMatchObject({ code: "PROVIDER_ERROR", providerErrorCode: "INVALID_API_KEY" });

      expect(mocks.connectionUpdate).not.toHaveBeenCalled();
      expect(mocks.connectionCreate).not.toHaveBeenCalled();
    });

    it("replaces an existing connection atomically via update", async () => {
      mocks.connectionFindFirst.mockResolvedValue({ id: "conn-1" });
      mocks.connectionUpdate.mockResolvedValue({ ...publicRow, defaultModel: "gpt-4o-mini" });

      await connectApiKey("tenant-1", "user-1", {
        provider: "openai",
        apiKey: "sk-new",
        defaultModel: "gpt-4o-mini",
      });

      expect(mocks.connectionUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "conn-1" },
          data: expect.objectContaining({ encryptedSecret: "encrypted-secret-opaque", defaultModel: "gpt-4o-mini" }),
        }),
      );
      expect(mocks.connectionCreate).not.toHaveBeenCalled();
    });

    it("rejects an unknown provider", async () => {
      await expect(
        connectApiKey("tenant-1", "user-1", { provider: "google", apiKey: "sk" }),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
      expect(mocks.validateApiKey).not.toHaveBeenCalled();
    });

    it("rejects an unknown model", async () => {
      await expect(
        connectApiKey("tenant-1", "user-1", { provider: "openai", apiKey: "sk", defaultModel: "nope" }),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    });

    it("rejects an empty API key", async () => {
      await expect(
        connectApiKey("tenant-1", "user-1", { provider: "openai", apiKey: "   " }),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    });

    it("surfaces a distinct CONFIGURATION_ERROR when encryption is unavailable", async () => {
      mocks.connectionFindFirst.mockResolvedValue(null);
      mocks.encryptAiSecret.mockImplementation(() => {
        throw new AiSecretCryptoError("AI_SECRET_KEY_MISSING", "not configured");
      });

      await expect(
        connectApiKey("tenant-1", "user-1", { provider: "openai", apiKey: "sk" }),
      ).rejects.toMatchObject({ code: "CONFIGURATION_ERROR" });

      expect(mocks.connectionCreate).not.toHaveBeenCalled();
    });

    it("maps a concurrent-create unique violation to CONFLICT", async () => {
      mocks.connectionFindFirst.mockResolvedValue(null);
      mocks.connectionCreate.mockRejectedValue({ code: "P2002" });

      await expect(
        connectApiKey("tenant-1", "user-1", { provider: "openai", apiKey: "sk" }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
    });
  });

  describe("revokeConnection", () => {
    it("clears the secret and marks the connection revoked", async () => {
      mocks.connectionFindFirst.mockResolvedValue({ id: "conn-1", status: "active" });
      mocks.connectionUpdate.mockResolvedValue({ ...publicRow, status: "revoked", revokedAt: new Date() });

      const result = await revokeConnection("tenant-1", "openai", "user-1");

      expect(mocks.connectionUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "revoked", encryptedSecret: null }),
        }),
      );
      expect(result.status).toBe("revoked");
      expect(mocks.auditCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: "revoked" }) }),
      );
    });

    it("throws NOT_FOUND when no connection exists", async () => {
      mocks.connectionFindFirst.mockResolvedValue(null);
      await expect(revokeConnection("tenant-1", "openai", "user-1")).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });
  });

  describe("validateConnection", () => {
    it("marks the connection invalid with a stored error code on failure", async () => {
      mocks.connectionFindFirst.mockResolvedValue({
        id: "conn-1",
        encryptedSecret: "enc:sk",
        defaultModel: "gpt-4o",
      });
      mocks.decryptAiSecret.mockReturnValue("sk");
      mocks.validateApiKey.mockRejectedValue(new AIProviderError("INVALID_API_KEY", "rejected"));
      mocks.connectionUpdate.mockResolvedValue({ ...publicRow, status: "invalid", lastErrorCode: "INVALID_API_KEY" });

      await expect(validateConnection("tenant-1", "openai", "user-1")).rejects.toMatchObject({
        code: "PROVIDER_ERROR",
        providerErrorCode: "INVALID_API_KEY",
      });

      expect(mocks.connectionUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "invalid", lastErrorCode: "INVALID_API_KEY" }),
        }),
      );
    });

    it("marks the connection active on success", async () => {
      mocks.connectionFindFirst.mockResolvedValue({
        id: "conn-1",
        encryptedSecret: "enc:sk",
        defaultModel: "gpt-4o",
      });
      mocks.decryptAiSecret.mockReturnValue("sk");
      mocks.validateApiKey.mockResolvedValue(undefined);
      mocks.connectionUpdate.mockResolvedValue(publicRow);

      const result = await validateConnection("tenant-1", "openai", "user-1");

      expect(result.status).toBe("active");
      expect(mocks.validateApiKey).toHaveBeenCalledWith("sk", "gpt-4o");
    });
  });

  describe("reconcileOrphanedConnections", () => {
    it("disables and clears the secret when the creator lost workspace access", async () => {
      mocks.connectionFindMany.mockResolvedValue([
        { id: "conn-1", provider: "openai", createdBy: "user-gone" },
      ]);
      mocks.profileFindUnique.mockResolvedValue({
        id: "user-gone",
        tenantId: "tenant-1",
        removedAt: new Date(),
      });
      mocks.connectionUpdate.mockResolvedValue(publicRow);

      await reconcileOrphanedConnections("tenant-1");

      expect(mocks.connectionUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "disabled", encryptedSecret: null }),
        }),
      );
    });

    it("leaves the connection untouched when the creator still has access", async () => {
      mocks.connectionFindMany.mockResolvedValue([
        { id: "conn-1", provider: "openai", createdBy: "user-active" },
      ]);
      mocks.profileFindUnique.mockResolvedValue({
        id: "user-active",
        tenantId: "tenant-1",
        removedAt: null,
      });

      await reconcileOrphanedConnections("tenant-1");

      expect(mocks.connectionUpdate).not.toHaveBeenCalled();
    });

    it("disables a connection when the creator moved to another tenant", async () => {
      mocks.connectionFindMany.mockResolvedValue([
        { id: "conn-2", provider: "openai", createdBy: "user-moved" },
      ]);
      mocks.profileFindUnique.mockResolvedValue({
        id: "user-moved",
        tenantId: "tenant-other",
        removedAt: null,
      });
      mocks.connectionUpdate.mockResolvedValue(publicRow);

      await reconcileOrphanedConnections("tenant-1");

      expect(mocks.connectionUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "conn-2" },
          data: expect.objectContaining({ status: "disabled", encryptedSecret: null }),
        }),
      );
    });
  });

  describe("listConnections", () => {
    it("strips the encrypted secret from the returned rows", async () => {
      mocks.connectionFindMany.mockResolvedValue([publicRow]);

      const result = await listConnections("tenant-1");

      expect(result).toHaveLength(1);
      expect(result[0]).not.toHaveProperty("encryptedSecret");
      expect(JSON.stringify(result)).not.toContain("encryptedSecret");
    });
  });

  describe("error shape", () => {
    it("exposes a machine-readable code", () => {
      const error = new AiConnectionError("NOT_FOUND", "missing");
      expect(error.code).toBe("NOT_FOUND");
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe("http error mapping", () => {
    it("maps a validation error to 400", () => {
      const res = mapAiConnectionError(new AiConnectionError("VALIDATION_ERROR", "nope"));
      expect(res.status).toBe(400);
    });

    it("maps a provider error to 502 with the provider error code", async () => {
      const res = mapAiConnectionError(
        new AiConnectionError("PROVIDER_ERROR", "rejected", "INVALID_API_KEY"),
      );
      expect(res.status).toBe(502);
      const json = await res.json();
      expect(json.error.code).toBe("PROVIDER_ERROR");
      expect(json.error.providerErrorCode).toBe("INVALID_API_KEY");
    });

    it("maps a concurrent-connect conflict to 409", () => {
      const res = mapAiConnectionError(new AiConnectionError("CONFLICT", "already exists"));
      expect(res.status).toBe(409);
    });

    it("maps a configuration error to 500", () => {
      const res = mapAiConnectionError(
        new AiConnectionError("CONFIGURATION_ERROR", "encryption not configured"),
      );
      expect(res.status).toBe(500);
    });
  });

  describe("permission catalog", () => {
    it("registers ai.manageConnections as a valid permission", () => {
      expect(isValidPermission("ai.manageConnections")).toBe(true);
    });

    it("grants ai.manageConnections to the Admin role by default", () => {
      const keys = allScopedPermissions().map(permissionKey);
      expect(keys).toContain("ai.manageConnections");
    });
  });
});
