import { NextResponse } from "next/server";
import { AiConnectionError } from "./connections-service";

const STATUS_BY_CODE: Record<AiConnectionError["code"], number> = {
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PROVIDER_ERROR: 502,
  CONFIGURATION_ERROR: 500,
  INTERNAL_ERROR: 500,
};

export function mapAiConnectionError(error: unknown): NextResponse {
  if (error instanceof AiConnectionError) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: error.code,
          message: error.message,
          ...(error.providerErrorCode ? { providerErrorCode: error.providerErrorCode } : {}),
        },
      },
      { status: STATUS_BY_CODE[error.code] },
    );
  }
  console.error("AI connection operation failed:", error);
  return NextResponse.json(
    {
      data: null,
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
    },
    { status: 500 },
  );
}
