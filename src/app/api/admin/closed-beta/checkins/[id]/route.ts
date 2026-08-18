import { NextResponse } from "next/server";
import { requireClosedBetaAdmin } from "@/lib/closed-beta/admin";
import { mapCheckinError } from "@/lib/closed-beta/checkin-http";
import {
  getCheckinEdition,
  updateCheckinEdition,
} from "@/lib/closed-beta/checkin";

export const dynamic = "force-dynamic";

function badRequest(message: string) {
  return NextResponse.json(
    { data: null, error: { code: "VALIDATION_ERROR", message } },
    { status: 400 },
  );
}

export async function GET(
  _request: Request,
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
  try {
    const edition = await getCheckinEdition(params.id);
    return NextResponse.json({ data: edition, error: null });
  } catch (error) {
    return mapCheckinError(error, "Unable to load check-in edition");
  }
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

  const { title, isMandatory, questions } = body as Record<string, unknown>;
  if (title !== undefined && (typeof title !== "string" || title.trim() === "")) {
    return badRequest("title must be a non-empty string");
  }
  if (isMandatory !== undefined && typeof isMandatory !== "boolean") {
    return badRequest("isMandatory must be a boolean");
  }
  if (questions !== undefined && !Array.isArray(questions)) {
    return badRequest("questions must be an array");
  }

  try {
    const edition = await updateCheckinEdition(
      params.id,
      {
        ...(title !== undefined ? { title: title as string } : {}),
        ...(isMandatory !== undefined ? { isMandatory: isMandatory as boolean } : {}),
        ...(questions !== undefined ? { questions: questions as never } : {}),
      },
      { userId: gate.user.id, email: gate.user.email ?? "" },
    );
    return NextResponse.json({ data: edition, error: null });
  } catch (error) {
    return mapCheckinError(error, "Unable to update check-in edition");
  }
}
