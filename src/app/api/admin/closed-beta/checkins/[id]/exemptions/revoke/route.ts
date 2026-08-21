import { NextResponse } from "next/server";
import { requireClosedBetaAdmin } from "@/lib/closed-beta/admin";
import { mapCheckinError } from "@/lib/closed-beta/checkin-http";
import { revokeCheckinExemption } from "@/lib/closed-beta/checkin";

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
  const workspaceId = body && typeof body === "object" ? (body as Record<string, unknown>).workspaceId : undefined;
  if (typeof workspaceId !== "string" || workspaceId === "") {
    return badRequest("workspaceId is required");
  }
  try {
    const state = await revokeCheckinExemption(params.id, workspaceId, {
      userId: gate.user.id,
      email: gate.user.email ?? "",
    });
    return NextResponse.json({ data: state, error: null });
  } catch (error) {
    return mapCheckinError(error, "Unable to revoke exemption");
  }
}
