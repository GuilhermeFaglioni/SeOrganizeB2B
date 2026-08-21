import { NextResponse } from "next/server";
import { requireClosedBetaAdmin } from "@/lib/closed-beta/admin";
import { mapCheckinError } from "@/lib/closed-beta/checkin-http";
import { grantCheckinExemption } from "@/lib/closed-beta/checkin";

export const dynamic = "force-dynamic";

function badRequest(message: string) {
  return NextResponse.json(
    { data: null, error: { code: "VALIDATION_ERROR", message } },
    { status: 400 },
  );
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
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return badRequest("Invalid request body");
  }
  const { workspaceId, reason, expiresAt } = body as Record<string, unknown>;
  if (typeof workspaceId !== "string" || workspaceId === "") {
    return badRequest("workspaceId is required");
  }
  if (typeof reason !== "string" || reason.trim() === "") {
    return badRequest("A reason is required");
  }
  const expiration = typeof expiresAt === "string" ? new Date(expiresAt) : null;
  if (!expiration || Number.isNaN(expiration.getTime())) {
    return badRequest("expiresAt must be an ISO date string");
  }
  try {
    const state = await grantCheckinExemption({
      editionId: params.id,
      workspaceId,
      reason,
      expiresAt: expiration,
      actor: { userId: gate.user.id, email: gate.user.email ?? "" },
    });
    return NextResponse.json({ data: state, error: null }, { status: 201 });
  } catch (error) {
    return mapCheckinError(error, "Unable to grant exemption");
  }
}
