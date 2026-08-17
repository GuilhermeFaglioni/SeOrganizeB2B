import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import {
  bindUserToWorkspace,
  BindingCodeInvalidError,
  BindingCodeRateLimitError,
  InviteAlreadyMemberError,
  InviteNotFoundError,
  OnboardingRequiredError,
} from "@/lib/invites/service";
import {
  ClosedBetaGuestCapacityError,
  ClosedBetaInactiveError,
} from "@/lib/closed-beta/service";

function errorResponse(
  code: string,
  message: string,
  status: number,
  data: unknown = null,
) {
  return NextResponse.json(
    { data, error: { code, message } },
    { status },
  );
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return errorResponse("AUTH_ERROR", "Unauthorized", 401);

  const body = await request.json().catch(() => null);
  if (!body || typeof body.bindingCode !== "string") {
    return errorResponse(
      "VALIDATION_ERROR",
      "A binding code is required",
      400,
    );
  }

  try {
    const result = await bindUserToWorkspace({
      userId: user.id,
      email: user.email ?? "",
      bindingCode: body.bindingCode,
      name: user.user_metadata?.full_name ?? user.email,
    });
    return NextResponse.json({ data: result.profile, error: null });
  } catch (error) {
    if (error instanceof BindingCodeRateLimitError) {
      return errorResponse(
        "RATE_LIMITED",
        "Too many attempts. Try again later.",
        429,
        { retryAt: error.retryAt },
      );
    }
    if (error instanceof BindingCodeInvalidError) {
      return errorResponse(
        "INVALID_BINDING_CODE",
        "The binding code could not be verified.",
        400,
      );
    }
    if (error instanceof OnboardingRequiredError) {
      return errorResponse(
        "ONBOARDING_REQUIRED",
        "Workspace onboarding requires another step.",
        409,
        error.state,
      );
    }
    if (error instanceof InviteAlreadyMemberError) {
      return errorResponse("CONFLICT", error.message, 409);
    }
    if (error instanceof InviteNotFoundError) {
      return errorResponse("NOT_FOUND", error.message, 404);
    }
    if (error instanceof ClosedBetaGuestCapacityError) {
      return errorResponse(
        "GUEST_CAPACITY_REACHED",
        "This workspace has no available guest slots.",
        409,
      );
    }
    if (error instanceof ClosedBetaInactiveError) {
      return errorResponse(
        "BETA_INACTIVE",
        "This workspace is not accepting new guests right now.",
        409,
      );
    }
    console.error("Workspace binding failed:", error);
    return errorResponse(
      "INTERNAL_ERROR",
      "An unexpected error occurred",
      500,
    );
  }
}
