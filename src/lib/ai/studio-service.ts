import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma, withTenant, withTenantBypass } from "../../../prisma/client";
import { checkFeature } from "../features";
import { getWorkspaceDirective } from "./directives-service";
import { decryptAiSecret } from "./crypto";
import {
  AIStudioSessionSnapshotError,
  createAIStudioSessionSnapshot,
  readAIStudioSessionSnapshot,
} from "./session-snapshot";
import {
  AIProviderError,
  type AIProvider,
  type AIProviderErrorCode,
  type AIProviderId,
} from "./provider-contract";
import { getAIProvider, isAIProviderId, listAIProviders } from "./providers";
import {
  compareVariables,
  buildStudioPrompts,
  compactSessionMessage,
  mergeSessionSummaries,
  parseStructuredOutput,
  validateSessionSummary,
  validateCandidateContract,
  AI_STUDIO_CONSENT_VERSION,
  AI_STUDIO_GENERATION_TIMEOUT_MS,
  AI_STUDIO_MAX_HTML_LENGTH,
  AI_STUDIO_MAX_CUSTOM_VARIABLES,
  AI_STUDIO_MAX_MESSAGE_LENGTH,
  AI_STUDIO_MAX_OUTPUT_TOKENS,
  AI_STUDIO_MAX_PROVIDER_PAYLOAD_BYTES,
  AI_STUDIO_MAX_RECENT_MESSAGES,
  AI_STUDIO_MAX_REQUEST_BYTES,
  AI_STUDIO_PROMPT_BASE_VERSION,
  AI_STUDIO_USAGE_RETENTION_DAYS,
  AI_STUDIO_WORKSPACE_RATE_LIMIT,
  AI_STUDIO_MAX_IMAGES_PER_MESSAGE,
  type AIStudioCandidateResponse,
  type AIStudioImageReference,
  type AIStudioImageAsset,
  type AIStudioSessionSummary,
  type AIStudioSessionMessage,
} from "./studio-contract";
import {
  readStudioImageBytes,
  readStudioImageReferences,
  releaseStudioMessageImages,
  releaseStudioImage,
  storeStudioImage,
  clearStudioImages,
  clearAllStudioImages,
  studioImageStats,
} from "./image-store";
import {
  AIStudioImageValidationError,
  validateStudioImages,
  AI_STUDIO_IMAGE_FORMATS_LABEL,
} from "./image-validation";
import { detectVariables } from "../financial/proposal-variables";
import { sanitizeProposalHtml, renderProposalHtml } from "../financial/proposals";
import { getActiveAIModelCatalogEntry, listActiveAIModelCatalog } from "./model-catalog";
import {
  closeManagedAICycle,
  recordManagedAICycleCandidate,
  refundManagedAICycleFailure,
  startOrResumeManagedAICycle,
  ManagedAICycleLimitError,
  type ManagedCycleState,
} from "./managed-cycle";

export type AIStudioErrorCode =
  | "VALIDATION_ERROR"
  | "FEATURE_GATED"
  | "KILL_SWITCHED"
  | "NO_PROVIDER"
  | "INVALID_MODEL"
  | "NO_VISION_MODEL"
  | "IMAGE_VALIDATION_ERROR"
  | "IMAGE_EXPIRED"
  | "CONNECTION_UNAVAILABLE"
  | "CONSENT_REQUIRED"
  | "RATE_LIMITED"
  | "GENERATION_IN_FLIGHT"
  | "TIMEOUT"
  | "INVALID_STRUCTURED_OUTPUT"
  | "PROVIDER_ERROR"
  | "CONFIGURATION_ERROR"
  | "TEMPLATE_NOT_FOUND"
  | "INVALID_BASE_HTML"
  | "UPDATE_CONFIRMATION_REQUIRED"
  | "PAYLOAD_LIMITED"
  | "INTERNAL_ERROR";

export class AIStudioError extends Error {
  readonly code: AIStudioErrorCode;
  readonly providerErrorCode?: AIProviderErrorCode;
  readonly providerStatus?: number;
  readonly providerErrorType?: string;
  readonly requestId?: string;
  readonly retryAfterSeconds?: number;
  readonly detailCode?: string;

  constructor(
    code: AIStudioErrorCode,
    message: string,
    options?: {
      providerErrorCode?: AIProviderErrorCode;
      providerStatus?: number;
      providerErrorType?: string;
      requestId?: string;
      retryAfterSeconds?: number;
      detailCode?: string;
    },
  ) {
    super(message);
    this.name = "AIStudioError";
    this.code = code;
    this.providerErrorCode = options?.providerErrorCode;
    this.providerStatus = options?.providerStatus;
    this.providerErrorType = options?.providerErrorType;
    this.requestId = options?.requestId;
    this.retryAfterSeconds = options?.retryAfterSeconds;
    this.detailCode = options?.detailCode;
  }
}

export interface AIStudioConnectionOption {
  id: string;
  provider: AIProviderId;
  defaultModel: string | null;
  models: Array<{
    id: string;
    vision: boolean;
    streaming: boolean;
    default: boolean;
    ownershipMode?: "managed" | "byok";
    creditCostPerCycle?: number;
  }>;
}

export interface AIStudioConfig {
  enabled: boolean;
  promptBaseVersion: string;
  consentVersion: string;
  directiveConfigured: boolean;
  connections: AIStudioConnectionOption[];
  consents: Record<string, { accepted: boolean; acceptedAt: string | null }>;
  models: Array<{ provider: string; model: string; ownershipMode: "managed" | "byok"; creditCostPerCycle: number }>;
}

export interface GenerateTemplateInput {
  tenantId: string;
  actorId: string;
  provider: unknown;
  model?: unknown;
  message: unknown;
  locale?: unknown;
  sessionId?: unknown;
  sessionSnapshot?: unknown;
  recentMessages?: unknown;
  sessionSummary?: unknown;
  consentVersion?: unknown;
  baseHtml?: unknown;
  stream?: boolean;
  imageIds?: unknown;
  imageFiles?: unknown;
  cycleId?: unknown;
}

export interface GeneratedTemplateResult {
  requestId: string;
  provider: AIProviderId;
  model: string;
  promptBaseVersion: string;
  streamed: boolean;
  sessionSnapshot?: string;
  candidate: AIStudioCandidateResponse & {
    variableDiff: ReturnType<typeof compareVariables>;
    warnings: string[];
  };
  cycle?: ManagedCycleState;
}

export interface SanitizedAiHtml {
  html: string;
  warnings: string[];
}

const inFlightGenerations = new Set<string>();

export function resetAIStudioRuntimeState(): void {
  inFlightGenerations.clear();
  clearStudioImagesAll();
}

function clearStudioImagesAll(): void {
  clearAllStudioImages();
}

export function isAIStudioEnabled(): boolean {
  const enabled = process.env.AI_STUDIO_ENABLED?.trim().toLowerCase();
  const killSwitch = process.env.AI_STUDIO_KILL_SWITCH?.trim().toLowerCase();
  return enabled !== "false" && enabled !== "0" && killSwitch !== "true" && killSwitch !== "1";
}

export function getAIStudioRateLimit(): number {
  const configured = Number(process.env.AI_STUDIO_WORKSPACE_RATE_LIMIT);
  if (!Number.isFinite(configured) || configured <= 0) return AI_STUDIO_WORKSPACE_RATE_LIMIT;
  return Math.floor(configured);
}

export function getAIStudioMaxRequestBytes(): number {
  const configured = Number(process.env.AI_STUDIO_MAX_REQUEST_BYTES);
  if (!Number.isFinite(configured) || configured <= 0) return AI_STUDIO_MAX_REQUEST_BYTES;
  return Math.floor(configured);
}

function normalizeLocale(value: unknown): string {
  return value === "en" || value === "en-US" ? "en" : "pt-BR";
}

function normalizeSessionId(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.trim().length > 128) {
    throw new AIStudioError("VALIDATION_ERROR", "Identificador de sessão inválido.");
  }
  return value.trim() || null;
}

async function readDirectiveSnapshot(tenantId: string): Promise<string | null> {
  const directive = await getWorkspaceDirective(tenantId);
  return directive?.content ?? null;
}

async function getPromptSnapshot(input: {
  tenantId: string;
  actorId: string;
  sessionId: string | null;
  sessionSnapshot: string | null;
  locale: string;
}): Promise<{ directive: string | null; locale: string; sessionSnapshot?: string }> {
  if (!input.sessionId) {
    return { directive: await readDirectiveSnapshot(input.tenantId), locale: input.locale };
  }

  if (input.sessionSnapshot) {
    try {
      const snapshot = readAIStudioSessionSnapshot(input.sessionSnapshot, {
        tenantId: input.tenantId,
        actorId: input.actorId,
        sessionId: input.sessionId,
      });
      return {
        directive: snapshot.directive,
        locale: snapshot.locale,
        sessionSnapshot: input.sessionSnapshot,
      };
    } catch (error) {
      if (error instanceof AIStudioSessionSnapshotError) {
        throw new AIStudioError("VALIDATION_ERROR", error.message, {
          detailCode: "SESSION_SNAPSHOT_INVALID",
        });
      }
      throw error;
    }
  }

  const directive = await readDirectiveSnapshot(input.tenantId);
  return {
    directive,
    locale: input.locale,
    sessionSnapshot: createAIStudioSessionSnapshot({
      tenantId: input.tenantId,
      actorId: input.actorId,
      sessionId: input.sessionId,
      locale: input.locale,
      directive,
    }),
  };
}

export function discardAIStudioSession(
  tenantId: string,
  actorId: string,
  sessionId: unknown,
): void {
  // The encrypted snapshot is held only by the browser; there is no server-side
  // transcript or revocation map to retain after the client discards it.
  void tenantId;
  void actorId;
  void sessionId;
}

function normalizeProvider(value: unknown): AIProviderId {
  if (!isAIProviderId(value)) {
    throw new AIStudioError("VALIDATION_ERROR", "Selecione um provider de IA válido.");
  }
  return value;
}

function providerOrThrow(id: AIProviderId): AIProvider {
  const provider = getAIProvider(id);
  if (!provider) {
    throw new AIStudioError("CONFIGURATION_ERROR", "O provider selecionado não está disponível.");
  }
  return provider;
}

function normalizeMessage(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new AIStudioError("VALIDATION_ERROR", "Descreva o template que você quer criar.");
  }
  const message = value.trim();
  if (message.length > AI_STUDIO_MAX_MESSAGE_LENGTH) {
    throw new AIStudioError(
      "VALIDATION_ERROR",
      `A mensagem deve ter no máximo ${AI_STUDIO_MAX_MESSAGE_LENGTH} caracteres.`,
    );
  }
  return message;
}

function normalizeSessionSummary(value: unknown): AIStudioSessionSummary | null {
  if (value === undefined || value === null || value === "") return null;
  const summary = validateSessionSummary(value);
  if (!summary) {
    throw new AIStudioError("VALIDATION_ERROR", "Resumo de sessão inválido.");
  }
  return summary;
}

function normalizeSessionSnapshot(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !value.trim() || value.length > 64 * 1024) {
    throw new AIStudioError("VALIDATION_ERROR", "Snapshot de sessão inválido.");
  }
  return value.trim();
}

function normalizeBaseHtml(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new AIStudioError("VALIDATION_ERROR", "O HTML-base da sessão é inválido.");
  }
  const base = value.trim();
  if (base.length > AI_STUDIO_MAX_HTML_LENGTH) {
    throw new AIStudioError(
      "VALIDATION_ERROR",
      `O HTML-base deve ter no máximo ${AI_STUDIO_MAX_HTML_LENGTH} caracteres.`,
    );
  }
  return base || null;
}

function normalizeRecentMessages(value: unknown): AIStudioSessionMessage[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new AIStudioError("VALIDATION_ERROR", "Mensagens recentes inválidas.");
  }
  return value.slice(-AI_STUDIO_MAX_RECENT_MESSAGES).map((item) => {
    if (!item || typeof item !== "object") {
      throw new AIStudioError("VALIDATION_ERROR", "Mensagem recente inválida.");
    }
    const candidate = item as { role?: unknown; content?: unknown };
    if (candidate.role !== "user" && candidate.role !== "assistant") {
      throw new AIStudioError("VALIDATION_ERROR", "Papel de mensagem inválido.");
    }
    if (typeof candidate.content !== "string" || !candidate.content.trim()) {
      throw new AIStudioError("VALIDATION_ERROR", "Conteúdo de mensagem inválido.");
    }
    return { role: candidate.role, content: compactSessionMessage(candidate.content) };
  });
}

function normalizeImageIds(value: unknown): string[] {
  if (value === undefined || value === null || value === "") return [];
  if (!Array.isArray(value)) {
    throw new AIStudioError("VALIDATION_ERROR", "Referências de imagem inválidas.");
  }
  if (value.length > AI_STUDIO_MAX_IMAGES_PER_MESSAGE) {
    throw new AIStudioError(
      "IMAGE_VALIDATION_ERROR",
      `No máximo ${AI_STUDIO_MAX_IMAGES_PER_MESSAGE} imagens por mensagem.`,
    );
  }
  const ids: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item)) {
      throw new AIStudioError("VALIDATION_ERROR", "Referência de imagem inválida.");
    }
    ids.push(item);
  }
  return ids;
}

function normalizeImageFiles(value: unknown): Array<{
  name: string;
  data: Buffer;
  contentType?: unknown;
}> {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new AIStudioError("VALIDATION_ERROR", "Arquivos de imagem inválidos.");
  }
  if (value.length > AI_STUDIO_MAX_IMAGES_PER_MESSAGE) {
    throw new AIStudioError(
      "IMAGE_VALIDATION_ERROR",
      `No máximo ${AI_STUDIO_MAX_IMAGES_PER_MESSAGE} imagens por mensagem.`,
    );
  }
  return value.map((item) => {
    if (!item || typeof item !== "object") {
      throw new AIStudioError("VALIDATION_ERROR", "Arquivo de imagem inválido.");
    }
    const file = item as { name?: unknown; data?: unknown; contentType?: unknown };
    if (typeof file.name !== "string" || !Buffer.isBuffer(file.data)) {
      throw new AIStudioError("VALIDATION_ERROR", "Arquivo de imagem inválido.");
    }
    return { name: file.name, data: file.data, contentType: file.contentType };
  });
}

function estimateImagePayloadBytes(images: AIStudioImageAsset[]): number {
  return images.reduce(
    (total, image) => total + Math.ceil((image.data.length * 4) / 3) + 512,
    0,
  );
}

function normalizeModel(provider: AIProvider, value: unknown): string {
  const model = typeof value === "string" && value.trim() ? value.trim() : provider.defaultModel;
  if (!provider.models.some((item) => item.id === model)) {
    throw new AIStudioError(
      "INVALID_MODEL",
      `O modelo selecionado não está disponível para ${provider.name}.`,
    );
  }
  return model;
}

async function modelsForConnection(
  provider: AIProvider,
  encryptedSecret: string | null,
): Promise<AIStudioConnectionOption["models"]> {
  if (!provider.listAvailableModels || !encryptedSecret) return provider.models;

  try {
    return await provider.listAvailableModels(decryptAiSecret(encryptedSecret));
  } catch {
    // A catalog outage must not hide a previously active connection. Explicit
    // validation and generation still use the provider's authoritative response.
    return provider.models;
  }
}

function stripExternalResources(html: string): { html: string; changed: boolean } {
  let changed = false;
  const withoutExternalImages = html.replace(/<img\b[^>]*>/gi, (tag) => {
    const source = tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1]?.trim().toLowerCase();
    if (source && /^(?:https?:|data:|\/\/)/i.test(source)) {
      changed = true;
      return "";
    }
    return tag;
  });
  const withoutExternalCss = withoutExternalImages
    .replace(/@import[^;]+;?/gi, () => {
      changed = true;
      return "";
    })
    .replace(/url\s*\(\s*["']?(?:https?:|data:|\/\/)[^)]*\)/gi, () => {
      changed = true;
      return "none";
    });
  return { html: withoutExternalCss, changed };
}

function hasVisibleContent(html: string): boolean {
  const withoutNonVisible = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .trim();
  return withoutNonVisible.length > 0;
}

export function sanitizeAIStudioHtml(rawHtml: string): SanitizedAiHtml {
  const source = rawHtml.trim();
  if (!source) {
    throw new AIStudioError("INVALID_STRUCTURED_OUTPUT", "O provider retornou HTML vazio.");
  }
  if (source.length > AI_STUDIO_MAX_HTML_LENGTH) {
    throw new AIStudioError(
      "VALIDATION_ERROR",
      `O HTML deve ter no máximo ${AI_STUDIO_MAX_HTML_LENGTH} caracteres.`,
    );
  }
  const sanitized = sanitizeProposalHtml(source);
  const externalSafe = stripExternalResources(sanitized);
  const html = externalSafe.html.trim();
  const warnings: string[] = [];
  if (html !== source || externalSafe.changed) {
    warnings.push("Alguns elementos HTML incompatíveis ou recursos externos foram removidos.");
  }
  if (!hasVisibleContent(html)) {
    throw new AIStudioError(
      "INVALID_STRUCTURED_OUTPUT",
      "O provider retornou um template sem conteúdo visível.",
    );
  }
  return { html, warnings };
}

function assertFeatureForStudio(tenantId: string): Promise<void> {
  return checkFeature(tenantId, "financial.proposals").then((allowed) => {
    if (!allowed) {
      throw new AIStudioError(
        "FEATURE_GATED",
        "O módulo financeiro de propostas não está habilitado para esta empresa.",
      );
    }
  });
}

async function readActiveConnection(tenantId: string, provider: AIProviderId) {
  return withTenant(tenantId, () =>
    prisma.aiProviderConnection.findFirst({
      where: {
        provider,
        status: "active",
        creator: { tenantId, removedAt: null },
      },
      select: {
        id: true,
        provider: true,
        authMethod: true,
        ownershipMode: true,
        encryptedSecret: true,
        defaultModel: true,
      },
    }),
  );
}

async function hasConsent(
  tenantId: string,
  provider: AIProviderId,
  version: string,
): Promise<boolean> {
  const consent = await withTenant(tenantId, () =>
    prisma.aiStudioConsent.findFirst({
      where: { provider, version },
      select: { id: true },
    }),
  );
  return Boolean(consent);
}

export async function recordAIStudioConsent(input: {
  tenantId: string;
  actorId: string;
  provider: unknown;
  version?: unknown;
}): Promise<{ provider: AIProviderId; version: string; consentedAt: Date }> {
  const provider = normalizeProvider(input.provider);
  const version = input.version === undefined ? AI_STUDIO_CONSENT_VERSION : input.version;
  if (version !== AI_STUDIO_CONSENT_VERSION) {
    throw new AIStudioError("VALIDATION_ERROR", "Versão de consentimento inválida.");
  }
  const connection = await readActiveConnection(input.tenantId, provider);
  const managedProviderAvailable =
    !connection &&
    (await listActiveAIModelCatalog()).some(
      (entry) => entry.provider === provider && entry.ownershipMode === "managed",
    );
  if (!connection && !managedProviderAvailable) {
    throw new AIStudioError("NO_PROVIDER", "Nenhuma conexão ativa foi encontrada para este provider.");
  }
  const consentedAt = new Date();
  await withTenant(input.tenantId, () =>
    prisma.aiStudioConsent.upsert({
      where: {
        tenantId_provider_version: {
          tenantId: input.tenantId,
          provider,
          version,
        },
      },
      update: { consentedBy: input.actorId, consentedAt },
      create: {
        tenantId: input.tenantId,
        provider,
        version,
        consentedBy: input.actorId,
        consentedAt,
      },
    }),
  );
  return { provider, version, consentedAt };
}

function mapImageValidationError(error: AIStudioImageValidationError): AIStudioError {
  return new AIStudioError(
    "IMAGE_VALIDATION_ERROR",
    error.code === "TOO_LARGE"
      ? "A imagem excede o limite de 5 MB por arquivo."
      : error.code === "TOO_MANY"
        ? `No máximo ${AI_STUDIO_MAX_IMAGES_PER_MESSAGE} imagens por mensagem.`
        : error.code === "UNSUPPORTED_FORMAT"
          ? `Formato de arquivo não suportado. Use ${AI_STUDIO_IMAGE_FORMATS_LABEL}.`
          : error.code === "MISMATCHED_FORMAT"
            ? "O conteúdo do arquivo não corresponde ao formato informado."
            : error.code === "INVALID_DIMENSIONS"
              ? "A imagem excede as dimensões máximas permitidas."
              : error.message,
    { detailCode: error.code },
  );
}

export async function attachAIStudioImage(
  tenantId: string,
  actorId: string,
  file: { name: string; data: Buffer; contentType?: unknown; uploadId?: unknown },
): Promise<AIStudioImageReference> {
  const uploadId = file.uploadId === undefined || file.uploadId === null || file.uploadId === ""
    ? null
    : typeof file.uploadId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(file.uploadId)
      ? file.uploadId
      : null;
  if (file.uploadId !== undefined && file.uploadId !== null && file.uploadId !== "" && !uploadId) {
    throw new AIStudioError("VALIDATION_ERROR", "Identificador de upload inválido.");
  }
  let validated: AIStudioImageAsset[];
  try {
    validated = await validateStudioImages([file]);
  } catch (error) {
    if (error instanceof AIStudioImageValidationError) throw mapImageValidationError(error);
    throw new AIStudioError(
      "IMAGE_VALIDATION_ERROR",
      "Não foi possível validar a imagem enviada.",
    );
  }
  const asset = validated[0];
  if (!asset) {
    throw new AIStudioError("IMAGE_VALIDATION_ERROR", "Nenhuma imagem válida foi enviada.");
  }
  if (uploadId) asset.id = uploadId;
  return storeStudioImage(tenantId, actorId, asset);
}

export function listAIStudioImages(
  tenantId: string,
  actorId: string,
): AIStudioImageReference[] {
  return readStudioImageReferences(tenantId, actorId);
}

export function discardAIStudioImage(
  tenantId: string,
  actorId: string,
  imageId: unknown,
): void {
  if (typeof imageId !== "string") return;
  releaseStudioImage(tenantId, actorId, imageId);
}

export function clearAIStudioImages(tenantId: string, actorId: string): void {
  clearStudioImages(tenantId, actorId);
}

export function getAIStudioImageStats(): {
  slots: number;
  images: number;
  bytes: number;
} {
  return studioImageStats();
}

export async function getAIStudioConfig(tenantId: string): Promise<AIStudioConfig> {
  const directive = await getWorkspaceDirective(tenantId);
  const [connections, consentRows, catalog] = await Promise.all([
    withTenant(tenantId, () =>
      prisma.aiProviderConnection.findMany({
        where: { status: "active", creator: { tenantId, removedAt: null } },
        select: { id: true, provider: true, defaultModel: true, encryptedSecret: true },
        orderBy: { createdAt: "asc" },
      }),
    ),
    withTenant(tenantId, () =>
      prisma.aiStudioConsent.findMany({
        where: { version: AI_STUDIO_CONSENT_VERSION },
        select: { provider: true, consentedAt: true },
      }),
    ),
    listActiveAIModelCatalog(),
  ]);

  const consentByProvider = Object.fromEntries(
    listAIProviders().map((provider) => [provider.id, { accepted: false, acceptedAt: null }]),
  ) as AIStudioConfig["consents"];
  for (const consent of consentRows) {
    if (isAIProviderId(consent.provider)) {
      consentByProvider[consent.provider] = {
        accepted: true,
        acceptedAt: consent.consentedAt.toISOString(),
      };
    }
  }

  const availableConnections = (
    await Promise.all(
      connections.map(async (connection) => {
        if (!isAIProviderId(connection.provider)) return null;
        const provider = getAIProvider(connection.provider);
        if (!provider) return null;
        return {
          id: connection.id,
          provider: connection.provider,
          defaultModel: connection.defaultModel,
          models: (await modelsForConnection(provider, connection.encryptedSecret)).map((model) => {
            const entry = catalog.find((item) => item.provider === connection.provider && item.model === model.id);
            return { ...model, ...(entry ? { ownershipMode: entry.ownershipMode, creditCostPerCycle: entry.creditCostPerCycle } : {}) };
          }),
        };
      }),
    )
  ).filter((connection): connection is AIStudioConnectionOption => connection !== null);

  const connectedProviders = new Set(availableConnections.map((connection) => connection.provider));
  const managedProviders = catalog
    .filter((entry) => entry.ownershipMode === "managed" && isAIProviderId(entry.provider) && !connectedProviders.has(entry.provider))
    .map((entry) => entry.provider)
    .filter((provider, index, providers): provider is AIProviderId => isAIProviderId(provider) && providers.indexOf(provider) === index);
  const managedConnections = managedProviders
    .map((provider): AIStudioConnectionOption | null => {
      const aiProvider = getAIProvider(provider);
      if (!aiProvider) return null;
      const managedCatalog = catalog.filter((entry) => entry.provider === provider && entry.ownershipMode === "managed");
      const models = aiProvider.models
        .filter((model) => managedCatalog.some((entry) => entry.model === model.id))
        .map((model) => {
          const entry = managedCatalog.find((item) => item.model === model.id);
          return { ...model, ownershipMode: "managed" as const, creditCostPerCycle: entry?.creditCostPerCycle };
        });
      return {
        id: `managed:${provider}`,
        provider,
        defaultModel: models.find((model) => model.default)?.id ?? models[0]?.id ?? null,
        models,
      };
    })
    .filter((connection): connection is AIStudioConnectionOption => connection !== null && connection.models.length > 0);

  return {
    enabled: isAIStudioEnabled(),
    promptBaseVersion: AI_STUDIO_PROMPT_BASE_VERSION,
    consentVersion: AI_STUDIO_CONSENT_VERSION,
    directiveConfigured: Boolean(directive?.content),
    connections: [...availableConnections, ...managedConnections],
    consents: consentByProvider,
    models: catalog.map((entry) => ({ provider: entry.provider, model: entry.model, ownershipMode: entry.ownershipMode, creditCostPerCycle: entry.creditCostPerCycle })),
  };
}

export function getAIStudioUsageRetentionCutoff(now = new Date()): Date {
  return new Date(now.getTime() - AI_STUDIO_USAGE_RETENTION_DAYS * 24 * 60 * 60 * 1_000);
}

export async function pruneAIStudioUsageEvents(tenantId: string, now = new Date()): Promise<void> {
  const cutoff = getAIStudioUsageRetentionCutoff(now);
  await withTenant(tenantId, () =>
    prisma.aiStudioUsageEvent.deleteMany({ where: { createdAt: { lt: cutoff } } }),
  );
}

export async function pruneAllAIStudioUsageEvents(now = new Date()): Promise<number> {
  const workspaces = await withTenantBypass(() =>
    prisma.workspace.findMany({ select: { id: true, status: true, deletedAt: true } }),
  );
  for (const workspace of workspaces) {
    await pruneAIStudioUsageEvents(workspace.id, now);
  }
  return workspaces.length;
}

async function reserveUsageEvent(input: {
  tenantId: string;
  actorId: string;
  provider: AIProviderId;
  authMethod: string;
  model: string;
  requestId: string;
}): Promise<void> {
  const since = new Date(Date.now() - 60 * 60 * 1_000);
  const retentionCutoff = getAIStudioUsageRetentionCutoff();

  await withTenant(input.tenantId, () =>
    prisma.$transaction(async (transaction: Prisma.TransactionClient) => {
      // Serialize reservations for a workspace so separate actors and app
      // instances cannot pass the same usage count concurrently.
      const workspaces = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "workspaces" WHERE id = ${input.tenantId} FOR UPDATE
      `;
      if (workspaces.length === 0) {
        throw new AIStudioError("INTERNAL_ERROR", "A empresa da sessão não foi encontrada.");
      }

      await transaction.aiStudioUsageEvent.deleteMany({
        where: { tenantId: input.tenantId, createdAt: { lt: retentionCutoff } },
      });
      const count = await transaction.aiStudioUsageEvent.count({
        where: { tenantId: input.tenantId, createdAt: { gte: since } },
      });
      if (count >= getAIStudioRateLimit()) {
        throw new AIStudioError(
          "RATE_LIMITED",
          "O limite de gerações desta empresa foi atingido. Tente novamente mais tarde.",
          { retryAfterSeconds: 60 * 60 },
        );
      }

      await transaction.aiStudioUsageEvent.create({
        data: {
          tenantId: input.tenantId,
          actorId: input.actorId,
          provider: input.provider,
          authMethod: input.authMethod,
          model: input.model,
          requestId: input.requestId,
          promptBaseVersion: AI_STUDIO_PROMPT_BASE_VERSION,
          requestSizeBytes: 0,
          responseSizeBytes: 0,
          latencyMs: 0,
          status: "in_flight",
          errorCategory: null,
          inputTokens: null,
          outputTokens: null,
          tokenUsageEstimated: false,
        },
      });
    }),
  );
}

async function recordUsageEvent(input: {
  tenantId: string;
  actorId: string;
  provider: AIProviderId;
  authMethod: string;
  model: string;
  requestId: string;
  requestSizeBytes: number;
  responseSizeBytes: number;
  latencyMs: number;
  status: "success" | "error";
  errorCategory?: string;
  inputTokens?: number;
  outputTokens?: number;
  tokenUsageEstimated?: boolean;
}): Promise<void> {
  try {
    await withTenant(input.tenantId, () =>
      prisma.aiStudioUsageEvent.updateMany({
        where: { tenantId: input.tenantId, requestId: input.requestId },
        data: {
          requestSizeBytes: input.requestSizeBytes,
          responseSizeBytes: input.responseSizeBytes,
          latencyMs: input.latencyMs,
          status: input.status,
          errorCategory: input.errorCategory ?? null,
          inputTokens: input.inputTokens ?? null,
          outputTokens: input.outputTokens ?? null,
          tokenUsageEstimated: input.tokenUsageEstimated ?? false,
        },
      }),
    );
  } catch (error) {
    // Generation must not fail because telemetry is unavailable. The error is
    // intentionally content-free so no prompt or HTML can reach logs.
    console.error("AI Studio usage event failed:", error);
  }
}

function mapProviderError(error: unknown, signal: AbortSignal, requestId: string): AIStudioError {
  if (signal.aborted) {
    return new AIStudioError("TIMEOUT", "A geração excedeu o limite de 90 segundos.", {
      providerErrorCode: "TIMEOUT",
      requestId,
    });
  }
  if (error instanceof AIProviderError) {
    if (error.code === "TIMEOUT") {
      return new AIStudioError("TIMEOUT", "A geração excedeu o limite de 90 segundos.", {
        providerErrorCode: error.code,
        requestId,
      });
    }
    return new AIStudioError("PROVIDER_ERROR", error.message, {
      providerErrorCode: error.code,
      requestId,
      providerStatus: error.providerStatus,
      providerErrorType: error.providerErrorType,
    });
  }
  return new AIStudioError(
    "PROVIDER_ERROR",
    "O provider não conseguiu concluir a geração. Tente novamente ou troque de provider.",
    { providerErrorCode: "UNKNOWN", requestId },
  );
}

export async function generateTemplateCandidate(
  input: GenerateTemplateInput,
  hooks?: { onPartial?: (text: string) => void },
): Promise<GeneratedTemplateResult> {
  if (!isAIStudioEnabled()) {
    throw new AIStudioError(
      "KILL_SWITCHED",
      "Novas gerações do AI Studio estão temporariamente desativadas.",
    );
  }
  await assertFeatureForStudio(input.tenantId);

  const providerId = normalizeProvider(input.provider);
  const provider = providerOrThrow(providerId);
  const message = normalizeMessage(input.message);
  const locale = normalizeLocale(input.locale);
  const sessionId = normalizeSessionId(input.sessionId);
  const sessionSnapshot = normalizeSessionSnapshot(input.sessionSnapshot);
  if (sessionSnapshot && !sessionId) {
    throw new AIStudioError("VALIDATION_ERROR", "Snapshot de sessão requer um identificador de sessão.");
  }
  const recentMessages = normalizeRecentMessages(input.recentMessages);
  const sessionSummary = normalizeSessionSummary(input.sessionSummary);
  const imageIds = normalizeImageIds(input.imageIds);
  const imageFiles = normalizeImageFiles(input.imageFiles);
  const baseHtml = normalizeBaseHtml(input.baseHtml);
  const sanitizedBase = baseHtml === null ? null : sanitizeAIStudioHtml(baseHtml);
  const connection = await readActiveConnection(input.tenantId, providerId);
  const requestedModel = input.model ?? connection?.defaultModel;
  const model = normalizeModel(provider, requestedModel);
  const catalog = await getActiveAIModelCatalogEntry(providerId, model).catch(() => null);
  const ownershipMode = catalog?.ownershipMode ?? connection?.ownershipMode ?? "byok";
  const managed = ownershipMode === "managed";
  if (managed && !catalog) {
    throw new AIStudioError("CONFIGURATION_ERROR", "O catálogo do modelo gerenciado não está configurado.");
  }
  if (catalog?.ownershipMode === "byok" && connection?.ownershipMode && connection.ownershipMode !== "byok") {
    throw new AIStudioError("CONNECTION_UNAVAILABLE", "O modelo selecionado requer uma conexão BYOK ativa.");
  }
  if (!managed && connection?.ownershipMode && connection.ownershipMode !== "byok") {
    throw new AIStudioError("CONNECTION_UNAVAILABLE", "A conexão selecionada não é uma conexão BYOK ativa.");
  }
  if (!managed && !connection?.encryptedSecret) {
    throw new AIStudioError("CONNECTION_UNAVAILABLE", "A conexão selecionada não está ativa. Configure ou valide o provider antes de gerar.");
  }
  const selectedModel = provider.models.find((item) => item.id === model) ?? (catalog ? {
    id: catalog.model, vision: catalog.vision, streaming: catalog.streaming, default: false,
  } : undefined);
  if (!selectedModel) {
    throw new AIStudioError("INVALID_MODEL", "O modelo selecionado não está disponível.");
  }
  if (imageIds.length > 0 && !selectedModel.vision) {
    throw new AIStudioError(
      "NO_VISION_MODEL",
      `O modelo ${model} não suporta imagens. Escolha um modelo com visão ou remova as imagens.`,
    );
  }
  if (input.consentVersion !== AI_STUDIO_CONSENT_VERSION) {
    throw new AIStudioError(
      "CONSENT_REQUIRED",
      "Confirme o consentimento de processamento externo antes de gerar.",
    );
  }
  if (!(await hasConsent(input.tenantId, providerId, AI_STUDIO_CONSENT_VERSION))) {
    throw new AIStudioError(
      "CONSENT_REQUIRED",
      "Confirme o consentimento de processamento externo antes de gerar.",
    );
  }

  const lockKey = `${input.tenantId}:${input.actorId}`;
  if (inFlightGenerations.has(lockKey)) {
    throw new AIStudioError(
      "GENERATION_IN_FLIGHT",
      "Você já tem uma geração em andamento. Aguarde a resposta atual.",
    );
  }
  inFlightGenerations.add(lockKey);
  const requestId = randomUUID();
  let managedCycle: ManagedCycleState | undefined;
  const startedAt = Date.now();
  let requestSizeBytes = 0;
  let responseSizeBytes = 0;
  let inputTokens: number | undefined;
  let outputTokens: number | undefined;
  let status: "success" | "error" = "error";
  let usableResponse = false;
  let errorCategory: string | undefined;
  let images: AIStudioImageAsset[] = [];

  try {
    if (imageFiles.length > 0) {
      try {
        images = await validateStudioImages(imageFiles);
      } catch (error) {
        if (error instanceof AIStudioImageValidationError) throw mapImageValidationError(error);
        throw error;
      }
    } else {
      images = imageIds.length > 0 ? readStudioImageBytes(input.tenantId, input.actorId, imageIds) : [];
    }
    if (imageFiles.length === 0 && imageIds.length > 0 && images.length < imageIds.length) {
      throw new AIStudioError(
        "IMAGE_EXPIRED",
        "Algumas imagens anexadas expiraram. Anexe novamente antes de gerar.",
      );
    }
    let secret: string;
    try {
      const managedSecret = managed
        ? process.env[`AI_STUDIO_MANAGED_${providerId.toUpperCase().replaceAll("-", "_")}_API_KEY`]
        : null;
      if (managed && !managedSecret) {
        throw new AIStudioError("CONFIGURATION_ERROR", "As credenciais gerenciadas deste provider não estão configuradas.");
      }
      secret = managedSecret ?? decryptAiSecret(connection!.encryptedSecret!);
    } catch {
      throw new AIStudioError(
        "CONFIGURATION_ERROR",
        "A credencial do provider não pôde ser descriptografada. Substitua a conexão.",
      );
    }

    const promptSnapshot = await getPromptSnapshot({
      tenantId: input.tenantId,
      actorId: input.actorId,
      sessionId,
      sessionSnapshot,
      locale,
    });
    const prompts = buildStudioPrompts({
      locale: promptSnapshot.locale,
      directive: promptSnapshot.directive,
      message,
      recentMessages,
      sessionSummary,
      baseHtml: sanitizedBase?.html ?? null,
      imageCount: images.length,
    });
    const promptBytes = Buffer.byteLength(
      `${prompts.systemPrompt}\n${prompts.userPrompt}`,
      "utf8",
    );
    requestSizeBytes = promptBytes + estimateImagePayloadBytes(images);
    if (
      promptBytes > getAIStudioMaxRequestBytes() ||
      requestSizeBytes > AI_STUDIO_MAX_PROVIDER_PAYLOAD_BYTES
    ) {
      throw new AIStudioError(
        "PAYLOAD_LIMITED",
        "O contexto da sessão excedeu o limite de payload. Reduza o HTML ou comece uma nova conversa com este rascunho.",
      );
    }

    // All request/image/credential/payload preflight is complete before any credit is reserved.
    await reserveUsageEvent({ tenantId: input.tenantId, actorId: input.actorId, provider: providerId, authMethod: managed ? "managed" : connection!.authMethod, model, requestId });
    if (managed && catalog) {
      const started = await startOrResumeManagedAICycle({ tenantId: input.tenantId, actorId: input.actorId, catalog, operationKey: `ai-studio-cycle:${input.tenantId}:${input.actorId}:${requestId}` });
      managedCycle = started.cycle;
      if (managedCycle.alterationCount >= 5) throw new AIStudioError("RATE_LIMITED", "Este ciclo já atingiu o limite de alterações utilizáveis.");
    } else if (catalog) {
      await closeManagedAICycle({ tenantId: input.tenantId, actorId: input.actorId, reason: "switched" });
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_STUDIO_GENERATION_TIMEOUT_MS);
    let rawText = "";
    let streamed = false;
    try {
      if (input.stream && selectedModel.streaming && provider.generateStructuredStream) {
        streamed = true;
        for await (const delta of provider.generateStructuredStream(secret, {
          model,
          systemPrompt: prompts.systemPrompt,
          userPrompt: prompts.userPrompt,
          maxOutputTokens: Math.min(AI_STUDIO_MAX_OUTPUT_TOKENS, catalog?.maxOutputTokens ?? AI_STUDIO_MAX_OUTPUT_TOKENS),
          signal: controller.signal,
          images,
        })) {
          rawText += delta;
          hooks?.onPartial?.(delta);
        }
      } else if (provider.generateStructured) {
        const result = await provider.generateStructured(secret, {
          model,
          systemPrompt: prompts.systemPrompt,
          userPrompt: prompts.userPrompt,
          maxOutputTokens: Math.min(AI_STUDIO_MAX_OUTPUT_TOKENS, catalog?.maxOutputTokens ?? AI_STUDIO_MAX_OUTPUT_TOKENS),
          signal: controller.signal,
          images,
        });
        rawText = result.text;
        inputTokens = result.inputTokens;
        outputTokens = result.outputTokens;
      } else {
        throw new AIStudioError(
          "CONFIGURATION_ERROR",
          "O provider selecionado não oferece geração estruturada para o AI Studio.",
        );
      }
    } catch (error) {
      if (error instanceof AIStudioError) throw error;
      const mapped = mapProviderError(error, controller.signal, requestId);
      console.error("AI Studio provider error:", {
        requestId,
        provider: providerId,
        model,
        code: mapped.providerErrorCode,
        providerStatus: mapped.providerStatus,
        providerErrorType: mapped.providerErrorType,
      });
      throw mapped;
    } finally {
      clearTimeout(timeout);
    }

    responseSizeBytes = Buffer.byteLength(rawText, "utf8");
    const contract = validateCandidateContract(parseStructuredOutput(rawText));
    if (!contract) {
      throw new AIStudioError(
        "INVALID_STRUCTURED_OUTPUT",
        "O provider retornou uma resposta fora do contrato. O último rascunho foi preservado.",
      );
    }
    const sanitized = sanitizeAIStudioHtml(contract.html);
    const variableDiff = compareVariables(sanitizedBase?.html ?? "", sanitized.html);
    const declaredCustom = new Set(contract.customVariables.map((variable) => variable.name));
    const usedCustom = detectVariables(sanitized.html)
      .filter((variable) => !variable.isSystem)
      .map((variable) => variable.name);
    if (usedCustom.some((name) => !declaredCustom.has(name))) {
      throw new AIStudioError(
        "INVALID_STRUCTURED_OUTPUT",
        "O provider não declarou todas as variáveis personalizadas usadas no HTML.",
      );
    }
    const mergedSessionSummary = mergeSessionSummaries(sessionSummary, {
      ...contract.sessionSummary,
      variables: Array.from(new Set(detectVariables(sanitized.html).map((variable) => variable.name))).slice(-AI_STUDIO_MAX_CUSTOM_VARIABLES),
    });
    status = "success";
    usableResponse = true;
    if (managedCycle) {
      managedCycle = await recordManagedAICycleCandidate({
        tenantId: input.tenantId, actorId: input.actorId, cycleId: managedCycle.id,
        html: sanitized.html, detectedVariables: mergedSessionSummary.variables, sessionSummary: mergedSessionSummary,
      });
    }
    return {
      requestId,
      provider: providerId,
      model,
      promptBaseVersion: AI_STUDIO_PROMPT_BASE_VERSION,
      streamed,
      candidate: {
        ...contract,
        sessionSummary: mergedSessionSummary,
        html: sanitized.html,
        variableDiff,
        warnings: [...(contract.warnings ?? []), ...(sanitizedBase?.warnings ?? []), ...sanitized.warnings],
      },
      ...(managedCycle ? { cycle: managedCycle } : {}),
      ...(promptSnapshot.sessionSnapshot
        ? { sessionSnapshot: promptSnapshot.sessionSnapshot }
        : {}),
    };
  } catch (error) {
    const normalized = error instanceof AIStudioError
      ? error
      : error instanceof ManagedAICycleLimitError
        ? new AIStudioError("RATE_LIMITED", "Este ciclo atingiu o limite de falhas reembolsadas.")
        : new AIStudioError("INTERNAL_ERROR", "Não foi possível concluir a geração.");
    errorCategory = normalized.providerErrorCode ?? normalized.code;
    if (managedCycle && !usableResponse) {
      try {
        managedCycle = await refundManagedAICycleFailure({ tenantId: input.tenantId, actorId: input.actorId, cycleId: managedCycle.id, requestId });
      } catch {
        // Preserve the provider error; the cycle service enforces refund idempotency and its cap.
      }
    }
    throw normalized;
  } finally {
    inFlightGenerations.delete(lockKey);
    if (imageIds.length > 0) releaseStudioMessageImages(input.tenantId, input.actorId, imageIds);
    const estimatedInputTokens = inputTokens ?? (requestSizeBytes > 0 ? Math.min(100_000, Math.ceil(requestSizeBytes / 4)) : undefined);
    const estimatedOutputTokens = outputTokens ?? (responseSizeBytes > 0 ? Math.min(AI_STUDIO_MAX_OUTPUT_TOKENS, Math.ceil(responseSizeBytes / 4)) : undefined);
    await recordUsageEvent({
      tenantId: input.tenantId,
      actorId: input.actorId,
      provider: providerId,
      authMethod: managed ? "managed" : connection!.authMethod,
      model,
      requestId,
      requestSizeBytes,
      responseSizeBytes,
      latencyMs: Date.now() - startedAt,
      status,
      errorCategory,
      inputTokens: estimatedInputTokens,
      outputTokens: estimatedOutputTokens,
      tokenUsageEstimated: (inputTokens === undefined || outputTokens === undefined) && (requestSizeBytes > 0 || responseSizeBytes > 0),
    });
  }
}

export interface AIStudioRefinementBase {
  id: string;
  name: string;
  html: string;
  warnings: string[];
  draftCount: number;
}

export async function getAIStudioRefinementBase(
  tenantId: string,
  templateId: unknown,
): Promise<AIStudioRefinementBase> {
  if (typeof templateId !== "string" || !templateId.trim()) {
    throw new AIStudioError("VALIDATION_ERROR", "Selecione um template para refinar.");
  }
  const template = await withTenant(tenantId, () =>
    prisma.proposalTemplate.findUnique({
      where: { id: templateId },
      select: { id: true, name: true, html: true },
    }),
  );
  if (!template) {
    throw new AIStudioError("TEMPLATE_NOT_FOUND", "O template selecionado não foi encontrado.");
  }
  let sanitized: SanitizedAiHtml;
  try {
    sanitized = sanitizeAIStudioHtml(template.html);
  } catch (error) {
    if (error instanceof AIStudioError) {
      throw new AIStudioError(
        "INVALID_BASE_HTML",
        "O template base não pôde ser preparado para esta sessão. Revise o HTML do template antes de refinar.",
      );
    }
    throw error;
  }
  const draftCount = await withTenant(tenantId, () =>
    prisma.proposal.count({ where: { templateId, status: "draft" } }),
  );
  return {
    id: template.id,
    name: template.name,
    html: sanitized.html,
    warnings: sanitized.warnings,
    draftCount,
  };
}

export interface UpdateRefinedTemplateInput {
  tenantId: string;
  actorId: string;
  templateId: unknown;
  html: unknown;
  confirmed: unknown;
  cycleId?: unknown;
}

export interface UpdatedRefinedTemplateResult {
  template: { id: string; name: string; html: string };
  warnings: string[];
  draftCount: number;
}

export async function updateRefinedTemplate(
  input: UpdateRefinedTemplateInput,
): Promise<UpdatedRefinedTemplateResult> {
  if (input.confirmed !== true) {
    throw new AIStudioError(
      "UPDATE_CONFIRMATION_REQUIRED",
      "Confirme a atualização do template original antes de prosseguir.",
    );
  }
  if (typeof input.templateId !== "string" || !input.templateId.trim()) {
    throw new AIStudioError("VALIDATION_ERROR", "Selecione o template original para atualizar.");
  }
  const templateId = input.templateId;
  if (typeof input.html !== "string" || !input.html.trim()) {
    throw new AIStudioError("VALIDATION_ERROR", "O HTML atualizado é obrigatório.");
  }
  const sanitized = sanitizeAIStudioHtml(input.html);
  const existing = await withTenant(input.tenantId, () =>
    prisma.proposalTemplate.findUnique({
      where: { id: templateId },
      select: { id: true, name: true },
    }),
  );
  if (!existing) {
    throw new AIStudioError("TEMPLATE_NOT_FOUND", "O template original não foi encontrado.");
  }
  const draftCount = await withTenant(input.tenantId, () =>
    prisma.proposal.count({
      where: { templateId: existing.id, status: "draft" },
    }),
  );
  const template = await withTenant(input.tenantId, () => prisma.$transaction(async (tx) => {
    const updated = await tx.proposalTemplate.update({
      where: { id: existing.id },
      data: { html: sanitized.html },
      select: { id: true, name: true, html: true },
    });
    if (typeof input.cycleId === "string") {
      await tx.aiStudioManagedCycle.updateMany({
        where: { id: input.cycleId, tenantId: input.tenantId, actorId: input.actorId, status: "active" },
        data: { status: "saved" },
      });
    }
    return updated;
  }));
  return { template, warnings: sanitized.warnings, draftCount };
}

export function renderAIStudioSyntheticPreview(html: string, locale = "pt-BR") {
  const sanitized = sanitizeAIStudioHtml(html);
  const values: Record<string, string> = {
    "cliente.nome": locale === "en" ? "Example Client" : "Cliente Exemplo",
    "cliente.razao_social": locale === "en" ? "Example Client LLC" : "Cliente Exemplo LTDA",
    "cliente.email": "cliente@example.com",
    "cliente.telefone": "(11) 99999-9999",
    "cliente.cpf_cnpj": "12.345.678/0001-90",
    "proposta.numero": "PRP-2026-0001",
    "proposta.titulo": locale === "en" ? "Example proposal" : "Proposta de exemplo",
    "proposta.data": locale === "en" ? "01/01/2026" : "01/01/2026",
    "proposta.validade": locale === "en" ? "01/31/2026" : "31/01/2026",
    "proposta.valor_total": locale === "en" ? "R$ 1,000.00" : "R$ 1.000,00",
    "empresa.nome": locale === "en" ? "Your Company" : "Sua Empresa",
  };
  for (const variable of detectVariables(sanitized.html)) {
    if (!variable.isSystem) values[variable.name] = `[${variable.name}]`;
  }
  return {
    html: renderProposalHtml(sanitized.html, {
      values,
      items: [
        {
          name: locale === "en" ? "Example service" : "Serviço de exemplo",
          quantity: "1",
          price: "1000.00",
          position: 0,
        },
      ],
      companyName: locale === "en" ? "Your Company" : "Sua Empresa",
      companyLogoUrl: null,
      locale,
    }),
    warnings: sanitized.warnings,
  };
}
