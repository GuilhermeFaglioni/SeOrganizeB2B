import { NextResponse } from "next/server";
import { requireClosedBetaAdmin } from "@/lib/closed-beta/admin";
import {
  QuestionBankNotFoundError,
  QuestionBankValidationError,
  createQuestionBankItem,
  listQuestionBankItems,
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

export async function GET(request: Request) {
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
  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? undefined;
  const theme = url.searchParams.get("theme") ?? undefined;
  try {
    const items = await listQuestionBankItems({
      ...(status === "active" || status === "archived" ? { status } : {}),
      ...(theme ? { theme } : {}),
    });
    return NextResponse.json({ data: items, error: null });
  } catch (error) {
    return mapBankError(error, "Unable to load question bank");
  }
}

export async function POST(request: Request) {
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
  if (typeof text !== "string" || text.trim() === "") {
    return badRequest("A question text is required");
  }
  if (typeof type !== "string") {
    return badRequest("A question type is required");
  }
  if (options !== undefined && !Array.isArray(options)) {
    return badRequest("options must be an array");
  }
  try {
    const item = await createQuestionBankItem(
      {
        text,
        type,
        options: options as string[] | undefined,
        required: required as boolean | undefined,
        theme: theme as string | null | undefined,
        isSuggestionQuestion: isSuggestionQuestion as boolean | undefined,
      },
      { userId: gate.user.id, email: gate.user.email ?? "" },
    );
    return NextResponse.json({ data: item, error: null }, { status: 201 });
  } catch (error) {
    return mapBankError(error, "Unable to create question bank item");
  }
}
