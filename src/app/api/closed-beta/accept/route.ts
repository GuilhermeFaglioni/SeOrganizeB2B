import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import {
  ClosedBetaCapacityError,
  ClosedBetaEmailMismatchError,
  ClosedBetaExistingAccountError,
  ClosedBetaInactiveError,
  ClosedBetaInvitationError,
  ClosedBetaTermsError,
  acceptPrimaryInvitation,
  consumeClosedBetaRateLimit,
} from "@/lib/closed-beta/service";

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Authentication required" } },
      { status: 401 },
    );
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!(await consumeClosedBetaRateLimit(`primary-accept:${user.id}:${ip}`, 10, 15 * 60 * 1000))) {
    return NextResponse.json(
      { data: null, error: { code: "RATE_LIMITED", message: "Try again later" } },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { data: null, error: { code: "INVALID_INVITATION", message: "The invitation could not be verified" } },
      { status: 400 },
    );
  }
  const input = body as Record<string, unknown>;
  if (typeof input.token !== "string" || typeof input.consentVersion !== "string") {
    return NextResponse.json(
      { data: null, error: { code: "INVALID_INVITATION", message: "The invitation could not be verified" } },
      { status: 400 },
    );
  }

  try {
    const result = await acceptPrimaryInvitation({
      token: input.token,
      userId: user.id,
      email: user.email ?? "",
      name:
        typeof user.user_metadata?.full_name === "string"
          ? user.user_metadata.full_name
          : user.email,
      emailConfirmedAt: user.email_confirmed_at ?? null,
      consentVersion: input.consentVersion,
    });
    return NextResponse.json({ data: result, error: null });
  } catch (error) {
    if (error instanceof ClosedBetaCapacityError || error instanceof ClosedBetaInactiveError) {
      return NextResponse.json(
        { data: null, error: { code: "BETA_UNAVAILABLE", message: "The beta invitation is no longer available" } },
        { status: 409 },
      );
    }
    if (error instanceof ClosedBetaEmailMismatchError) {
      return NextResponse.json(
        { data: null, error: { code: "EMAIL_MISMATCH", message: "Use the invited email to continue" } },
        { status: 403 },
      );
    }
    if (error instanceof ClosedBetaExistingAccountError) {
      return NextResponse.json(
        { data: null, error: { code: "ACCOUNT_ALREADY_LINKED", message: "This account is already associated with a company" } },
        { status: 409 },
      );
    }
    if (error instanceof ClosedBetaTermsError) {
      return NextResponse.json(
        { data: null, error: { code: "TERMS_REQUIRED", message: error.message } },
        { status: 400 },
      );
    }
    if (error instanceof ClosedBetaInvitationError) {
      return NextResponse.json(
        { data: null, error: { code: "INVALID_INVITATION", message: "The invitation could not be verified" } },
        { status: 400 },
      );
    }
    console.error("Closed Beta invitation acceptance failed:", error);
    return NextResponse.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Unexpected error" } },
      { status: 500 },
    );
  }
}
