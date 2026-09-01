import { NextResponse } from "next/server";
import { denyFor } from "../authz/authz";
import { getTenantContext } from "../authz/tenant-context";
import { noWorkspaceResponse } from "../authz/http";
import {
  AIStudioError,
  getAIStudioMaxRequestBytes,
  type AIStudioErrorCode,
} from "./studio-service";
import { checkFeature } from "../features";
import {
  AI_STUDIO_MAX_GENERATION_REQUEST_BYTES,
  AI_STUDIO_MAX_RECENT_MESSAGES,
} from "./studio-contract";

const STATUS_BY_CODE: Record<AIStudioErrorCode, number> = {
  VALIDATION_ERROR: 400,
  FEATURE_GATED: 403,
  KILL_SWITCHED: 503,
  NO_PROVIDER: 409,
  INVALID_MODEL: 400,
  NO_VISION_MODEL: 400,
  IMAGE_VALIDATION_ERROR: 422,
  IMAGE_EXPIRED: 410,
  CONNECTION_UNAVAILABLE: 409,
  CONSENT_REQUIRED: 428,
  RATE_LIMITED: 429,
  INSUFFICIENT_CREDITS: 402,
  GENERATION_IN_FLIGHT: 409,
  TIMEOUT: 504,
  INVALID_STRUCTURED_OUTPUT: 502,
  PROVIDER_ERROR: 502,
  CONFIGURATION_ERROR: 500,
  TEMPLATE_NOT_FOUND: 404,
  INVALID_BASE_HTML: 422,
  UPDATE_CONFIRMATION_REQUIRED: 428,
  PAYLOAD_LIMITED: 413,
  INTERNAL_ERROR: 500,
};

export function mapAIStudioError(error: unknown): NextResponse {
  if (
    error instanceof Error &&
    "code" in error &&
    error.code === "LIMIT_EXCEEDED"
  ) {
    const message = error.message;
    return NextResponse.json(
      { data: null, error: { code: "LIMIT_EXCEEDED", message } },
      { status: 429 },
    );
  }
  if (error instanceof AIStudioError) {
    const headers = new Headers();
    if (error.retryAfterSeconds) {
      headers.set("Retry-After", String(error.retryAfterSeconds));
    }
    return NextResponse.json(
      {
        data: null,
        error: {
          code: error.code,
          ...(error.code === "PROVIDER_ERROR" &&
          (error.providerStatus || error.providerErrorType)
            ? { message: error.message }
            : {}),
          ...(error.providerErrorCode
            ? { providerErrorCode: error.providerErrorCode }
            : {}),
          ...(error.providerStatus
            ? { providerStatus: error.providerStatus }
            : {}),
          ...(error.providerErrorType
            ? { providerErrorType: error.providerErrorType }
            : {}),
          ...(error.requestId ? { requestId: error.requestId } : {}),
          ...(error.detailCode ? { detailCode: error.detailCode } : {}),
          ...(error.retryAfterSeconds
            ? { retryAfterSeconds: error.retryAfterSeconds }
            : {}),
        },
      },
      { status: STATUS_BY_CODE[error.code], headers },
    );
  }
  console.error("AI Studio operation failed:", error);
  return NextResponse.json(
    {
      data: null,
      error: {
        code: "INTERNAL_ERROR",
        message: "Não foi possível concluir a operação do AI Studio.",
      },
    },
    { status: 500 },
  );
}

export function unauthorizedResponse(): NextResponse {
  return NextResponse.json(
    { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
    { status: 401 },
  );
}

export async function requireAIStudioAccess(userId: string) {
  const templateDenied = await denyFor(
    userId,
    "financial.proposals.manageTemplates",
  );
  if (templateDenied) return { response: templateDenied } as const;
  const generationDenied = await denyFor(
    userId,
    "financial.proposals.generateWithAi",
  );
  if (generationDenied) return { response: generationDenied } as const;

  const context = await getTenantContext(userId);
  if (!context.tenantId) return { response: noWorkspaceResponse() } as const;
  if (!(await checkFeature(context.tenantId, "financial.proposals"))) {
    return {
      response: NextResponse.json(
        {
          data: null,
          error: {
            code: "FEATURE_GATED",
            message:
              "O módulo financeiro de propostas não está habilitado para esta empresa.",
          },
        },
        { status: 403 },
      ),
    } as const;
  }
  return { tenantId: context.tenantId } as const;
}

export async function readJsonBody(
  request: Request,
  maxBytes = getAIStudioMaxRequestBytes(),
): Promise<Record<string, unknown> | null> {
  try {
    const raw = new TextDecoder().decode(
      await readRequestBodyBytes(request, maxBytes),
    );
    const body = JSON.parse(raw) as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    const record = body as Record<string, unknown>;
    if (
      Array.isArray(record.recentMessages) &&
      record.recentMessages.length > AI_STUDIO_MAX_RECENT_MESSAGES
    ) {
      throw new AIStudioError(
        "PAYLOAD_LIMITED",
        "A sessão excede o limite de mensagens recentes. Comece uma nova conversa.",
      );
    }
    return record;
  } catch (error) {
    if (error instanceof AIStudioError) throw error;
    return null;
  }
}

export async function readRequestBodyBytes(
  request: Request,
  maxBytes: number,
): Promise<Uint8Array> {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new AIStudioError(
      "PAYLOAD_LIMITED",
      "O corpo da requisição excede o limite permitido.",
    );
  }

  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          // The payload is already rejected; cancellation is best effort.
        }
        throw new AIStudioError(
          "PAYLOAD_LIMITED",
          "O corpo da requisição excede o limite permitido.",
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  if (chunks.length === 0) return new Uint8Array();
  if (chunks.length === 1) return chunks[0];

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function readMultipartFormData(
  request: Request,
  maxBytes = AI_STUDIO_MAX_GENERATION_REQUEST_BYTES,
): Promise<FormData> {
  const body = await readRequestBodyBytes(request, maxBytes);
  const buffer = new ArrayBuffer(body.byteLength);
  new Uint8Array(buffer).set(body);
  return new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: buffer,
  }).formData();
}
