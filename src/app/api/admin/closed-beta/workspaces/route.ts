import { NextResponse } from "next/server";
import { requireClosedBetaAdmin } from "@/lib/closed-beta/admin";
import {
  ClosedBetaCapacityError,
  ClosedBetaInactiveError,
  ClosedBetaNotFoundError,
  ClosedBetaValidationError,
  enrollExistingWorkspace,
  listClosedBetaWorkspaces,
} from "@/lib/closed-beta/service";

export const dynamic = "force-dynamic";

function gateError(reason: "unauthorized" | "forbidden") {
  return NextResponse.json(
    {
      data: null,
      error: {
        code: reason === "unauthorized" ? "AUTH_ERROR" : "FORBIDDEN",
        message: reason === "unauthorized" ? "Unauthorized" : "Forbidden",
      },
    },
    { status: reason === "unauthorized" ? 401 : 403 },
  );
}

function domainError(error: unknown) {
  if (error instanceof ClosedBetaNotFoundError) {
    return NextResponse.json(
      { data: null, error: { code: "NOT_FOUND", message: error.message } },
      { status: 404 },
    );
  }
  if (error instanceof ClosedBetaCapacityError || error instanceof ClosedBetaInactiveError) {
    return NextResponse.json(
      { data: null, error: { code: "BETA_UNAVAILABLE", message: error.message } },
      { status: 409 },
    );
  }
  if (error instanceof ClosedBetaValidationError) {
    return NextResponse.json(
      { data: null, error: { code: "VALIDATION_ERROR", message: error.message } },
      { status: 400 },
    );
  }
  console.error("Closed Beta workspace operation failed:", error);
  return NextResponse.json(
    { data: null, error: { code: "INTERNAL_ERROR", message: "Unexpected error" } },
    { status: 500 },
  );
}

export async function GET() {
  const gate = await requireClosedBetaAdmin();
  if (!gate.ok) return gateError(gate.reason);
  try {
    return NextResponse.json({ data: await listClosedBetaWorkspaces(), error: null });
  } catch (error) {
    return domainError(error);
  }
}

export async function POST(request: Request) {
  const gate = await requireClosedBetaAdmin();
  if (!gate.ok) return gateError(gate.reason);
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { data: null, error: { code: "VALIDATION_ERROR", message: "Invalid request body" } },
      { status: 400 },
    );
  }
  const input = body as Record<string, unknown>;
  if (typeof input.workspaceId !== "string" || typeof input.ownerProfileId !== "string") {
    return NextResponse.json(
      { data: null, error: { code: "VALIDATION_ERROR", message: "workspaceId and ownerProfileId are required" } },
      { status: 400 },
    );
  }
  try {
    const enrollment = await enrollExistingWorkspace(
      input.workspaceId,
      input.ownerProfileId,
      { userId: gate.user.id, email: gate.user.email ?? "" },
    );
    return NextResponse.json({ data: enrollment, error: null }, { status: 201 });
  } catch (error) {
    return domainError(error);
  }
}
