import { NextResponse } from "next/server";
import { requireClosedBetaAdmin } from "@/lib/closed-beta/admin";
import {
  QuestionBankNotFoundError,
  QuestionBankValidationError,
  setQuestionBankItemStatus,
  updateQuestionBankItem,
} from "@/lib/closed-beta/question-bank";

export const dynamic = "force-dynamic";

function badRequest(message: string) {
  return NextResponse.json(
    { data: null, error: { code: "VALIDATION_ERROR", message } },
    { status: 400 },
  );
}

function mapBankError(error: unknown, fallback: string): NextResponse {
  if (error instanceof QuestionBankValidationError) {
    return NextResponse.json(
      { data: null, error: { code: "VALIDATION_ERROR", message: error.message } },
      { status: 400 },
    );
  }
  if (error instanceof QuestionBankNotFoundError) {
    return NextResponse.json(
      { data: null, error: { code: "NOT_FOUND", message: error.message } },
      { status: 404 },
    );
  }
  console.error("Question bank operation failed:", error);
  return NextResponse.json(
    { data: null, error: { code: "INTERNAL_ERROR", message: fallback } },
    { status: 500 },
  );
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const gate = await requireClosedBetaAdmin();
  if (!gate.ok) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: gate.reason === "unauthorized" ? "AUTH_ERROR" : "FORBIDDEN",
          message: gate.reason === "unauthorized" ? "Unauthorized" : "Forbidden",
        },
      },
      { status: gate.reason === "unauthorized" ? 401 : 403 },
    );
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return badRequest("Invalid request body");
  }
  const { text, type, options, required, theme, isSuggestionQuestion } = body as Record<string, unknown>;
  if (text !== undefined && (typeof text !== "string" || text.trim() === "")) {
    return badRequest("text must be a non-empty string");
  }
  if (type !== undefined && typeof type !== "string") {
    return badRequest("type must be a string");
  }
  if (options !== undefined && !Array.isArray(options)) {
    return badRequest("options must be an array");
  }
  try {
    const item = await updateQuestionBankItem(
      params.id,
      {
        ...(text !== undefined ? { text: text as string } : {}),
        ...(type !== undefined ? { type: type as string } : {}),
        ...(options !== undefined ? { options: options as string[] } : {}),
        ...(required !== undefined ? { required: required as boolean } : {}),
        ...(theme !== undefined ? { theme: theme as string | null } : {}),
        ...(isSuggestionQuestion !== undefined ? { isSuggestionQuestion: isSuggestionQuestion as boolean } : {}),
      },
      { userId: gate.user.id, email: gate.user.email ?? "" },
    );
    return NextResponse.json({ data: item, error: null });
  } catch (error) {
    return mapBankError(error, "Unable to update question bank item");
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const gate = await requireClosedBetaAdmin();
  if (!gate.ok) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: gate.reason === "unauthorized" ? "AUTH_ERROR" : "FORBIDDEN",
          message: gate.reason === "unauthorized" ? "Unauthorized" : "Forbidden",
        },
      },
      { status: gate.reason === "unauthorized" ? 401 : 403 },
    );
  }
  const body = await request.json().catch(() => null);
  const status = body && typeof body === "object" ? (body as Record<string, unknown>).status : undefined;
  if (status !== "archived" && status !== "active") {
    return badRequest("status must be 'active' or 'archived'");
  }
  try {
    const item = await setQuestionBankItemStatus(
      params.id,
      status,
      { userId: gate.user.id, email: gate.user.email ?? "" },
    );
    return NextResponse.json({ data: item, error: null });
  } catch (error) {
    return mapBankError(error, "Unable to update question bank item status");
  }
}
