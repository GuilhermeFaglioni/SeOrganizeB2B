import { prisma, requireTenantId, withTenant } from "../../../prisma/client";
import { AiSecretCryptoError, decryptAiSecret, encryptAiSecret } from "./crypto";
import { AIProviderError, type AIProvider, type AIProviderId } from "./provider-contract";
import { getAIProvider, isAIProviderId } from "./providers";
import type { Prisma } from "@prisma/client";

export type AIConnectionStatus =
  | "active"
  | "invalid"
  | "expired"
  | "revoked"
  | "disabled";
export type AIConnectionOwnershipMode = "managed" | "byok";

export type AIConnectionErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "PROVIDER_ERROR"
  | "CONFIGURATION_ERROR"
  | "CONFLICT"
  | "INTERNAL_ERROR";

export class AiConnectionError extends Error {
  readonly code: AIConnectionErrorCode;
  readonly providerErrorCode?: string;

  constructor(code: AIConnectionErrorCode, message: string, providerErrorCode?: string) {
    super(message);
    this.name = "AiConnectionError";
    this.code = code;
    this.providerErrorCode = providerErrorCode;
  }
}

export interface AiConnectInput {
  provider: unknown;
  apiKey: unknown;
  defaultModel?: unknown;
}

export interface PublicConnection {
  id: string;
  provider: string;
  authMethod: string;
  ownershipMode: AIConnectionOwnershipMode;
  defaultModel: string | null;
  status: AIConnectionStatus;
  createdBy: string;
  validatedAt: Date | null;
  lastErrorCode: string | null;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

type ConnectionRow = {
  id: string;
  provider: string;
  authMethod: string;
  ownershipMode: string;
  defaultModel: string | null;
  status: string;
  createdBy: string;
  validatedAt: Date | null;
  lastErrorCode: string | null;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const PUBLIC_FIELDS = {
  id: true,
  provider: true,
  authMethod: true,
  ownershipMode: true,
  defaultModel: true,
  status: true,
  createdBy: true,
  validatedAt: true,
  lastErrorCode: true,
  revokedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

function toPublic(row: ConnectionRow): PublicConnection {
  return {
    ...row,
    ownershipMode: row.ownershipMode === "managed" ? "managed" : "byok",
    status: row.status as AIConnectionStatus,
  };
}

function providerFrom(input: unknown): AIProviderId {
  if (!isAIProviderId(input)) {
    throw new AiConnectionError("VALIDATION_ERROR", "Unknown provider");
  }
  return input;
}

function requireProvider(providerId: AIProviderId): AIProvider {
  const provider = getAIProvider(providerId);
  if (!provider) {
    throw new AiConnectionError("VALIDATION_ERROR", `Provider "${providerId}" is not available`);
  }
  return provider;
}

function normalizeApiKey(input: unknown): string {
  if (typeof input !== "string" || !input.trim()) {
    throw new AiConnectionError("VALIDATION_ERROR", "An API key is required");
  }
  return input.trim();
}

function resolveModel(provider: AIProvider, input: unknown): string {
  const requested = typeof input === "string" && input.trim() ? input.trim() : provider.defaultModel;
  if (!provider.models.some((model) => model.id === requested)) {
    throw new AiConnectionError(
      "VALIDATION_ERROR",
      `Unknown model "${requested}" for provider "${provider.id}"`,
    );
  }
  return requested;
}

function assertApiKeySupported(provider: AIProvider): void {
  if (!provider.authMethods.includes("api_key")) {
    throw new AiConnectionError(
      "VALIDATION_ERROR",
      `Provider "${provider.id}" does not support API key authentication`,
    );
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

async function recordAudit(
  client: Prisma.TransactionClient | typeof prisma,
  connectionId: string,
  action: string,
  actorId: string | null,
  provider: string,
  result: "success" | "failure",
  metadata?: Record<string, unknown>,
): Promise<void> {
  await client.aiProviderConnectionAudit.create({
    data: {
      connectionId,
      provider,
      action,
      actorId,
      result,
      metadata: metadata as Prisma.InputJsonValue | undefined,
      tenantId: requireTenantId("ai.connections.audit"),
    },
  });
}

/**
 * Disables any connection whose creator no longer has workspace access
 * (profile removed or moved to another tenant). The secret is removed and the
 * action is audited, requiring a new authorized connection.
 */
export async function reconcileOrphanedConnections(tenantId: string): Promise<void> {
  await withTenant(tenantId, async () => {
    const connections = await prisma.aiProviderConnection.findMany({
      where: { status: { notIn: ["revoked", "disabled"] } },
      select: { id: true, provider: true, createdBy: true },
    });

    for (const connection of connections) {
      const creator = await prisma.profile.findUnique({
        where: { id: connection.createdBy },
        select: { id: true, tenantId: true, removedAt: true },
      });
      const orphaned =
        !creator ||
        creator.tenantId !== tenantId ||
        creator.removedAt !== null;
      if (!orphaned) continue;

      await prisma.aiProviderConnection.update({
        where: { id: connection.id },
        data: {
          status: "disabled",
          encryptedSecret: null,
        },
      });
      await recordAudit(
        prisma,
        connection.id,
        "disabled",
        null,
        connection.provider,
        "success",
        { reason: "creator_lost_access" },
      );
    }
  });
}

export async function listConnections(tenantId: string): Promise<PublicConnection[]> {
  await reconcileOrphanedConnections(tenantId);
  return withTenant(tenantId, async () => {
    const rows = await prisma.aiProviderConnection.findMany({
      select: PUBLIC_FIELDS,
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toPublic);
  });
}

export async function getConnection(
  tenantId: string,
  providerId: AIProviderId,
): Promise<PublicConnection | null> {
  await reconcileOrphanedConnections(tenantId);
  return withTenant(tenantId, async () => {
    const row = await prisma.aiProviderConnection.findFirst({
      where: { provider: providerId },
      select: PUBLIC_FIELDS,
    });
    return row ? toPublic(row) : null;
  });
}

/**
 * Connects or replaces a provider connection with an official API key.
 * The key is validated server-side before any state changes. Providers without
 * an authenticated metadata endpoint may use a minimal validation request.
 * On validation failure the previous connection is preserved.
 */
export async function connectApiKey(
  tenantId: string,
  actorId: string,
  input: AiConnectInput,
): Promise<PublicConnection> {
  const providerId = providerFrom(input.provider);
  const provider = requireProvider(providerId);
  assertApiKeySupported(provider);
  const apiKey = normalizeApiKey(input.apiKey);
  const model = resolveModel(provider, input.defaultModel);

  try {
    await provider.validateApiKey(apiKey, model);
  } catch (error) {
    if (error instanceof AIProviderError) {
      throw new AiConnectionError(
        "PROVIDER_ERROR",
        error.message,
        error.code,
      );
    }
    throw new AiConnectionError(
      "PROVIDER_ERROR",
      "The provider could not validate the API key right now. Try again later.",
      "UNKNOWN",
    );
  }

  let encrypted: string;
  try {
    encrypted = encryptAiSecret(apiKey);
  } catch (error) {
    if (error instanceof AiSecretCryptoError) {
      throw new AiConnectionError(
        "CONFIGURATION_ERROR",
        "AI provider secret encryption is not configured on the server. Contact an administrator.",
      );
    }
    throw error;
  }

  return withTenant(tenantId, async () => {
    const existing = await prisma.aiProviderConnection.findFirst({
      where: { provider: providerId },
      select: { id: true },
    });

    const data = {
      provider: providerId,
      authMethod: "api_key",
      ownershipMode: "byok",
      encryptedSecret: encrypted,
      defaultModel: model,
      status: "active",
      createdBy: actorId,
      validatedAt: new Date(),
      lastErrorCode: null,
      revokedAt: null,
    };

    if (existing) {
      const updated = await prisma.aiProviderConnection.update({
        where: { id: existing.id },
        data,
        select: PUBLIC_FIELDS,
      });
      await recordAudit(
        prisma,
        updated.id,
        "replaced",
        actorId,
        providerId,
        "success",
        { model },
      );
      return toPublic(updated);
    }

    let created;
    try {
      created = await prisma.aiProviderConnection.create({
        data: { ...data, tenantId: requireTenantId("ai.connections") },
        select: PUBLIC_FIELDS,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AiConnectionError(
          "CONFLICT",
          "A connection for this provider was just created. Refresh and try again.",
        );
      }
      throw error;
    }
    await recordAudit(
      prisma,
      created.id,
      "connected",
      actorId,
      providerId,
      "success",
      { model },
    );
    return toPublic(created);
  });
}

/**
 * Re-validates a stored connection against the provider. On failure the
 * connection moves to `invalid` and the actionable error code is stored; the
 * secret is preserved so an admin can replace it.
 */
export async function validateConnection(
  tenantId: string,
  providerId: AIProviderId,
  actorId: string,
): Promise<PublicConnection> {
  const provider = requireProvider(providerId);

  return withTenant(tenantId, async () => {
    const existing = await prisma.aiProviderConnection.findFirst({
      where: { provider: providerId },
      select: { id: true, encryptedSecret: true, defaultModel: true },
    });
    if (!existing || !existing.encryptedSecret) {
      throw new AiConnectionError("NOT_FOUND", `No active connection for provider "${providerId}"`);
    }

    let secret: string;
    try {
      secret = decryptAiSecret(existing.encryptedSecret);
    } catch {
      throw new AiConnectionError(
        "INTERNAL_ERROR",
        "The stored credential could not be decrypted. Replace the connection.",
      );
    }

    try {
      await provider.validateApiKey(secret, existing.defaultModel ?? undefined);
    } catch (error) {
      const code = error instanceof AIProviderError ? error.code : "UNKNOWN";
      const message = error instanceof AIProviderError
        ? error.message
        : "The provider could not validate the API key right now.";
      await prisma.aiProviderConnection.update({
        where: { id: existing.id },
        data: { status: "invalid", lastErrorCode: code },
      });
      await recordAudit(prisma, existing.id, "validated", actorId, providerId, "failure", {
        errorCode: code,
      });
      throw new AiConnectionError("PROVIDER_ERROR", message, code);
    }

    const updated = await prisma.aiProviderConnection.update({
      where: { id: existing.id },
      data: { status: "active", validatedAt: new Date(), lastErrorCode: null },
      select: PUBLIC_FIELDS,
    });
    await recordAudit(prisma, existing.id, "validated", actorId, providerId, "success");
    return toPublic(updated);
  });
}

/**
 * Revokes a connection: removes the stored secret and records the action. The
 * integration stops appearing as available for use.
 */
export async function revokeConnection(
  tenantId: string,
  providerId: AIProviderId,
  actorId: string,
): Promise<PublicConnection> {
  return withTenant(tenantId, async () => {
    const existing = await prisma.aiProviderConnection.findFirst({
      where: { provider: providerId },
      select: { id: true, status: true },
    });
    if (!existing) {
      throw new AiConnectionError("NOT_FOUND", `No connection for provider "${providerId}"`);
    }

    const updated = await prisma.aiProviderConnection.update({
      where: { id: existing.id },
      data: {
        status: "revoked",
        encryptedSecret: null,
        revokedAt: new Date(),
        lastErrorCode: null,
      },
      select: PUBLIC_FIELDS,
    });
    await recordAudit(prisma, existing.id, "revoked", actorId, providerId, "success");
    return toPublic(updated);
  });
}
