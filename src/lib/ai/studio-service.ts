import { randomUUID } from "node:crypto";
import { prisma, withTenant } from "../../../prisma/client";
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
  readonly retryAfterSeconds?: number;
  readonly detailCode?: string;

  constructor(
    code: AIStudioErrorCode,
    message: string,
    options?: {
      providerErrorCode?: AIProviderErrorCode;
      retryAfterSeconds?: number;
      detailCode?: string;
    },
  ) {
    super(message);
    this.name = "AIStudioError";
    this.code = code;
    this.providerErrorCode = options?.providerErrorCode;
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
  }>;
}

export interface AIStudioConfig {
  enabled: boolean;
  promptBaseVersion: string;
  consentVersion: string;
  directiveConfigured: boolean;
  connections: AIStudioConnectionOption[];
  consents: Record<string, { accepted: boolean; acceptedAt: string | null }>;
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
  if (!connection) {
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
  const [connections, consentRows] = await Promise.all([
    withTenant(tenantId, () =>
      prisma.aiProviderConnection.findMany({
        where: { status: "active", creator: { tenantId, removedAt: null } },
        select: { id: true, provider: true, defaultModel: true },
        orderBy: { createdAt: "asc" },
      }),
    ),
    withTenant(tenantId, () =>
      prisma.aiStudioConsent.findMany({
        where: { version: AI_STUDIO_CONSENT_VERSION },
        select: { provider: true, consentedAt: true },
      }),
    ),
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

  const availableConnections = connections.flatMap((connection) => {
    if (!isAIProviderId(connection.provider)) return [];
    const provider = getAIProvider(connection.provider);
    if (!provider) return [];
    return [
      {
        id: connection.id,
        provider: connection.provider,
        defaultModel: connection.defaultModel,
        models: provider.models,
      },
    ];
  });

  return {
    enabled: isAIStudioEnabled(),
    promptBaseVersion: AI_STUDIO_PROMPT_BASE_VERSION,
    consentVersion: AI_STUDIO_CONSENT_VERSION,
    directiveConfigured: Boolean(directive?.content),
    connections: availableConnections,
    consents: consentByProvider,
  };
}

async function pruneUsageEvents(tenantId: string): Promise<void> {
  const cutoff = new Date(Date.now() - AI_STUDIO_USAGE_RETENTION_DAYS * 24 * 60 * 60 * 1_000);
  await withTenant(tenantId, () =>
    prisma.aiStudioUsageEvent.deleteMany({ where: { createdAt: { lt: cutoff } } }),
  );
}

async function assertWorkspaceRateLimit(tenantId: string): Promise<void> {
  await pruneUsageEvents(tenantId);
  const since = new Date(Date.now() - 60 * 60 * 1_000);
  const count = await withTenant(tenantId, () =>
    prisma.aiStudioUsageEvent.count({ where: { createdAt: { gte: since } } }),
  );
  if (count >= getAIStudioRateLimit()) {
    throw new AIStudioError(
      "RATE_LIMITED",
      "O limite de gerações desta empresa foi atingido. Tente novamente mais tarde.",
      { retryAfterSeconds: 60 * 60 },
    );
  }
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
}): Promise<void> {
  try {
    await withTenant(input.tenantId, () =>
      prisma.aiStudioUsageEvent.create({
        data: {
          tenantId: input.tenantId,
          actorId: input.actorId,
          provider: input.provider,
          authMethod: input.authMethod,
          model: input.model,
          requestId: input.requestId,
          promptBaseVersion: AI_STUDIO_PROMPT_BASE_VERSION,
          requestSizeBytes: input.requestSizeBytes,
          responseSizeBytes: input.responseSizeBytes,
          latencyMs: input.latencyMs,
          status: input.status,
          errorCategory: input.errorCategory ?? null,
          inputTokens: input.inputTokens ?? null,
          outputTokens: input.outputTokens ?? null,
        },
      }),
    );
  } catch (error) {
    // Generation must not fail because telemetry is unavailable. The error is
    // intentionally content-free so no prompt or HTML can reach logs.
    console.error("AI Studio usage event failed:", error);
  }
}

function mapProviderError(error: unknown, signal: AbortSignal): AIStudioError {
  if (signal.aborted) {
    return new AIStudioError("TIMEOUT", "A geração excedeu o limite de 90 segundos.", {
      providerErrorCode: "TIMEOUT",
    });
  }
  if (error instanceof AIProviderError) {
    if (error.code === "TIMEOUT") {
      return new AIStudioError("TIMEOUT", "A geração excedeu o limite de 90 segundos.", {
        providerErrorCode: error.code,
      });
    }
    return new AIStudioError("PROVIDER_ERROR", error.message, {
      providerErrorCode: error.code,
    });
  }
  return new AIStudioError(
    "PROVIDER_ERROR",
    "O provider não conseguiu concluir a geração. Tente novamente ou troque de provider.",
    { providerErrorCode: "UNKNOWN" },
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
  const baseHtml = normalizeBaseHtml(input.baseHtml);
  const sanitizedBase = baseHtml === null ? null : sanitizeAIStudioHtml(baseHtml);
  const connection = await readActiveConnection(input.tenantId, providerId);
  if (!connection?.encryptedSecret) {
    throw new AIStudioError(
      "CONNECTION_UNAVAILABLE",
      "A conexão selecionada não está ativa. Configure ou valide o provider antes de gerar.",
    );
  }
  const model = normalizeModel(provider, input.model ?? connection.defaultModel);
  const selectedModel = provider.models.find((item) => item.id === model);
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
  // This guard is process-local. The persisted workspace rate limit still
  // applies across instances, while this synchronous add closes the local
  // check/await race for concurrent requests from the same actor.
  try {
    await assertWorkspaceRateLimit(input.tenantId);
  } catch (error) {
    inFlightGenerations.delete(lockKey);
    throw error;
  }

  const requestId = randomUUID();
  const startedAt = Date.now();
  let requestSizeBytes = 0;
  let responseSizeBytes = 0;
  let inputTokens: number | undefined;
  let outputTokens: number | undefined;
  let status: "success" | "error" = "error";
  let errorCategory: string | undefined;
  let images: AIStudioImageAsset[] = [];

  try {
    images = imageIds.length > 0 ? readStudioImageBytes(input.tenantId, input.actorId, imageIds) : [];
    if (imageIds.length > 0 && images.length < imageIds.length) {
      throw new AIStudioError(
        "IMAGE_EXPIRED",
        "Algumas imagens anexadas expiraram. Anexe novamente antes de gerar.",
      );
    }
    let secret: string;
    try {
      secret = decryptAiSecret(connection.encryptedSecret);
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
          maxOutputTokens: AI_STUDIO_MAX_OUTPUT_TOKENS,
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
          maxOutputTokens: AI_STUDIO_MAX_OUTPUT_TOKENS,
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
      throw mapProviderError(error, controller.signal);
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
      ...(promptSnapshot.sessionSnapshot
        ? { sessionSnapshot: promptSnapshot.sessionSnapshot }
        : {}),
    };
  } catch (error) {
    const normalized = error instanceof AIStudioError
      ? error
      : new AIStudioError("INTERNAL_ERROR", "Não foi possível concluir a geração.");
    errorCategory = normalized.providerErrorCode ?? normalized.code;
    throw normalized;
  } finally {
    inFlightGenerations.delete(lockKey);
    if (imageIds.length > 0) releaseStudioMessageImages(input.tenantId, input.actorId, imageIds);
    await recordUsageEvent({
      tenantId: input.tenantId,
      actorId: input.actorId,
      provider: providerId,
      authMethod: connection.authMethod,
      model,
      requestId,
      requestSizeBytes,
      responseSizeBytes,
      latencyMs: Date.now() - startedAt,
      status,
      errorCategory,
      inputTokens,
      outputTokens,
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
  const template = await withTenant(input.tenantId, () =>
    prisma.proposalTemplate.update({
      where: { id: existing.id },
      data: { html: sanitized.html },
      select: { id: true, name: true, html: true },
    }),
  );
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
