import { NextResponse } from "next/server";
import { requireClosedBetaAdmin } from "@/lib/closed-beta/admin";
import {
  ClosedBetaCapacityError,
  ClosedBetaExistingAccountError,
  ClosedBetaInactiveError,
  ClosedBetaInvitationError,
  ClosedBetaValidationError,
  createPrimaryInvitation,
  consumeClosedBetaRateLimit,
  listPrimaryInvitations,
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
  if (error instanceof ClosedBetaCapacityError) {
    return NextResponse.json(
      { data: null, error: { code: "CAPACITY_REACHED", message: "Closed Beta is full" } },
      { status: 409 },
    );
  }
  if (
    error instanceof ClosedBetaValidationError ||
    error instanceof ClosedBetaExistingAccountError ||
    error instanceof ClosedBetaInvitationError
  ) {
    return NextResponse.json(
      { data: null, error: { code: "VALIDATION_ERROR", message: error.message } },
      { status: 400 },
    );
  }
  if (error instanceof ClosedBetaInactiveError) {
    return NextResponse.json(
      { data: null, error: { code: "BETA_INACTIVE", message: "Closed Beta is not accepting invitations" } },
      { status: 409 },
    );
  }
  console.error("Closed Beta primary invitation failed:", error);
  return NextResponse.json(
    { data: null, error: { code: "INTERNAL_ERROR", message: "Unexpected error" } },
    { status: 500 },
  );
}

export async function GET() {
  const gate = await requireClosedBetaAdmin();
  if (!gate.ok) return gateError(gate.reason);

  try {
    const invitations = await listPrimaryInvitations();
    return NextResponse.json({ data: invitations, error: null });
  } catch (error) {
    return domainError(error);
  }
}

export async function POST(request: Request) {
  const gate = await requireClosedBetaAdmin();
  if (!gate.ok) return gateError(gate.reason);

  if (!(await consumeClosedBetaRateLimit(`admin-primary-invite:${gate.user.id}`, 20, 60 * 60 * 1000))) {
    return NextResponse.json(
      { data: null, error: { code: "RATE_LIMITED", message: "Try again later" } },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const email =
    body && typeof body === "object" && !Array.isArray(body) && "email" in body
      ? (body as { email?: unknown }).email
      : null;
  if (typeof email !== "string") {
    return NextResponse.json(
      { data: null, error: { code: "VALIDATION_ERROR", message: "email is required" } },
      { status: 400 },
    );
  }

  try {
    const invitation = await createPrimaryInvitation(email, {
      userId: gate.user.id,
      email: gate.user.email ?? "",
    });
    return NextResponse.json({ data: invitation, error: null }, { status: 201 });
  } catch (error) {
    return domainError(error);
  }
}
