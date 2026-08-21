import { NextResponse } from "next/server";
import {
  closedBetaAdminErrorResponse,
  requireClosedBetaAdmin,
} from "@/lib/closed-beta/admin";
import { mapCheckinError } from "@/lib/closed-beta/checkin-http";
import {
  createCheckinEdition,
  listCheckinEditions,
} from "@/lib/closed-beta/checkin";

export const dynamic = "force-dynamic";

function badRequest(message: string) {
  return NextResponse.json(
    { data: null, error: { code: "VALIDATION_ERROR", message } },
    { status: 400 },
  );
}

export async function GET() {
  const gate = await requireClosedBetaAdmin();
  if (!gate.ok) {
    return closedBetaAdminErrorResponse(gate);
  }
  try {
    const editions = await listCheckinEditions();
    return NextResponse.json({ data: editions, error: null });
  } catch (error) {
    return mapCheckinError(error, "Unable to load check-in editions");
  }
}

export async function POST(request: Request) {
  const gate = await requireClosedBetaAdmin();
  if (!gate.ok) {
    return closedBetaAdminErrorResponse(gate);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return badRequest("Invalid request body");
  }

  const { title, isMandatory, questions } = body as Record<string, unknown>;
  if (typeof title !== "string" || title.trim() === "") {
    return badRequest("An edition title is required");
  }
  if (!Array.isArray(questions)) {
    return badRequest("questions must be an array");
  }
  if (isMandatory !== undefined && typeof isMandatory !== "boolean") {
    return badRequest("isMandatory must be a boolean");
  }

  try {
    const edition = await createCheckinEdition(
      {
        title: title.trim(),
        isMandatory: isMandatory as boolean | undefined,
        questions: questions as never,
      },
      { userId: gate.user.id, email: gate.user.email ?? "" },
    );
    return NextResponse.json({ data: edition, error: null }, { status: 201 });
  } catch (error) {
    return mapCheckinError(error, "Unable to create check-in edition");
  }
}
