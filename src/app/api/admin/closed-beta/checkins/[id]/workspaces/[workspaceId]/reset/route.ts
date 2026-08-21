import { NextResponse } from "next/server";
import { requireClosedBetaAdmin } from "@/lib/closed-beta/admin";
import { mapCheckinError } from "@/lib/closed-beta/checkin-http";
import { resetCheckinResponse } from "@/lib/closed-beta/checkin";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  props: { params: Promise<{ id: string; workspaceId: string }> },
) {
  const params = await props.params;
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
    const result = await resetCheckinResponse(params.id, params.workspaceId, {
      userId: gate.user.id,
      email: gate.user.email ?? "",
    });
    return NextResponse.json({ data: result, error: null });
  } catch (error) {
    return mapCheckinError(error, "Unable to reset check-in response");
  }
}
