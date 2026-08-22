import { NextResponse } from "next/server";
import { denyFor } from "../authz/authz";
import { getTenantContext } from "../authz/tenant-context";
import { noWorkspaceResponse } from "../authz/http";
import { AIStudioError, type AIStudioErrorCode } from "./studio-service";
import { checkFeature } from "../features";

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
          message: error.message,
          ...(error.providerErrorCode ? { providerErrorCode: error.providerErrorCode } : {}),
          ...(error.detailCode ? { detailCode: error.detailCode } : {}),
          ...(error.retryAfterSeconds ? { retryAfterSeconds: error.retryAfterSeconds } : {}),
        },
      },
      { status: STATUS_BY_CODE[error.code], headers },
    );
  }
  console.error("AI Studio operation failed:", error);
  return NextResponse.json(
    { data: null, error: { code: "INTERNAL_ERROR", message: "Não foi possível concluir a operação do AI Studio." } },
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
  const templateDenied = await denyFor(userId, "financial.proposals.manageTemplates");
  if (templateDenied) return { response: templateDenied } as const;
  const generationDenied = await denyFor(userId, "financial.proposals.generateWithAi");
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
            message: "O módulo financeiro de propostas não está habilitado para esta empresa.",
          },
        },
        { status: 403 },
      ),
    } as const;
  }
  return { tenantId: context.tenantId } as const;
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
