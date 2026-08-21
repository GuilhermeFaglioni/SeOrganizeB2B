import { NextResponse } from "next/server";
import { requireClosedBetaAdmin } from "@/lib/closed-beta/admin";
import {
  ClosedBetaNotFoundError,
  removeClosedBetaEnrollment,
} from "@/lib/closed-beta/service";

export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, props: { params: Promise<{ id: string }> }) {
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
    const enrollment = await removeClosedBetaEnrollment(params.id, {
      userId: gate.user.id,
      email: gate.user.email ?? "",
    });
    return NextResponse.json({ data: enrollment, error: null });
  } catch (error) {
    if (error instanceof ClosedBetaNotFoundError) {
      return NextResponse.json(
        { data: null, error: { code: "NOT_FOUND", message: error.message } },
        { status: 404 },
      );
    }
    console.error("Closed Beta workspace removal failed:", error);
    return NextResponse.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Unexpected error" } },
      { status: 500 },
    );
  }
}
