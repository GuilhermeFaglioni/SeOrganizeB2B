import { NextResponse } from "next/server";
import { requireClosedBetaAdmin } from "@/lib/closed-beta/admin";
import {
  ClosedBetaCapacityError,
  ClosedBetaInactiveError,
  ClosedBetaInvitationError,
  ClosedBetaNotFoundError,
  consumeClosedBetaRateLimit,
  reissuePrimaryInvitation,
  revokePrimaryInvitation,
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

function errorResponse(error: unknown) {
  if (error instanceof ClosedBetaNotFoundError) {
    return NextResponse.json(
      { data: null, error: { code: "NOT_FOUND", message: error.message } },
      { status: 404 },
    );
  }
  if (error instanceof ClosedBetaCapacityError || error instanceof ClosedBetaInactiveError) {
    return NextResponse.json(
      { data: null, error: { code: "CAPACITY_OR_STATUS", message: error.message } },
      { status: 409 },
    );
  }
  if (error instanceof ClosedBetaInvitationError) {
    return NextResponse.json(
      { data: null, error: { code: "VALIDATION_ERROR", message: error.message } },
      { status: 400 },
    );
  }
  console.error("Closed Beta invitation mutation failed:", error);
  return NextResponse.json(
    { data: null, error: { code: "INTERNAL_ERROR", message: "Unexpected error" } },
    { status: 500 },
  );
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const gate = await requireClosedBetaAdmin();
  if (!gate.ok) return gateError(gate.reason);

  if (!(await consumeClosedBetaRateLimit(`admin-primary-invite:${gate.user.id}`, 20, 60 * 60 * 1000))) {
    return NextResponse.json(
      { data: null, error: { code: "RATE_LIMITED", message: "Try again later" } },
      { status: 429 },
    );
  }

  try {
    const invitation = await revokePrimaryInvitation(params.id, {
      userId: gate.user.id,
      email: gate.user.email ?? "",
    });
    return NextResponse.json({ data: invitation, error: null });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const gate = await requireClosedBetaAdmin();
  if (!gate.ok) return gateError(gate.reason);

  if (!(await consumeClosedBetaRateLimit(`admin-primary-invite:${gate.user.id}`, 20, 60 * 60 * 1000))) {
    return NextResponse.json(
      { data: null, error: { code: "RATE_LIMITED", message: "Try again later" } },
      { status: 429 },
    );
  }

  try {
    const invitation = await reissuePrimaryInvitation(params.id, {
      userId: gate.user.id,
      email: gate.user.email ?? "",
    });
    return NextResponse.json({ data: invitation, error: null });
  } catch (error) {
    return errorResponse(error);
  }
}
