import { NextResponse } from "next/server";
import { requireClosedBetaAdmin } from "@/lib/closed-beta/admin";
import { mapCheckinError } from "@/lib/closed-beta/checkin-http";
import { duplicateCheckinEdition } from "@/lib/closed-beta/checkin";

export const dynamic = "force-dynamic";

export async function POST(
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
    const edition = await duplicateCheckinEdition(params.id, {
      userId: gate.user.id,
      email: gate.user.email ?? "",
    });
    return NextResponse.json({ data: edition, error: null }, { status: 201 });
  } catch (error) {
    return mapCheckinError(error, "Unable to duplicate check-in edition");
  }
}
