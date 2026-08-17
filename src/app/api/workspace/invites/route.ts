import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getEffectivePermissions } from "@/lib/authz/authz";
import {
  createInvite,
  getWorkspaceIdForUser,
  listInvites,
  InviteValidationError,
} from "@/lib/invites/service";
import {
  ClosedBetaGuestCapacityError,
  ClosedBetaInactiveError,
  consumeClosedBetaRateLimit,
} from "@/lib/closed-beta/service";

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }
  const effective = await getEffectivePermissions(user.id);
  if (!effective.isAdmin) {
    return NextResponse.json({ data: null, error: { code: "FORBIDDEN", message: "Only admins can manage invites" } }, { status: 403 });
  }
  const workspaceId = await getWorkspaceIdForUser(user.id);
  if (!workspaceId) {
    return NextResponse.json({ data: null, error: { code: "VALIDATION_ERROR", message: "No workspace associated with this account" } }, { status: 400 });
  }

  const invites = await listInvites(workspaceId);
  return NextResponse.json({ data: invites, error: null });
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }
  const effective = await getEffectivePermissions(user.id);
  if (!effective.isAdmin) {
    return NextResponse.json({ data: null, error: { code: "FORBIDDEN", message: "Only admins can invite collaborators" } }, { status: 403 });
  }
  const workspaceId = await getWorkspaceIdForUser(user.id);
  if (!workspaceId) {
    return NextResponse.json({ data: null, error: { code: "VALIDATION_ERROR", message: "No workspace associated with this account" } }, { status: 400 });
  }

  if (!(await consumeClosedBetaRateLimit(`guest-invite:${user.id}`, 30, 60 * 60 * 1000))) {
    return NextResponse.json(
      { data: null, error: { code: "RATE_LIMITED", message: "Try again later" } },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : "";
  const roleId = typeof body?.roleId === "string" ? body.roleId : null;

  try {
    const invite = await createInvite({
      workspaceId,
      email,
      roleId,
      actor: { userId: user.id, email: user.email ?? "" },
    });
    const { token, ...publicInvite } = invite;
    void token;
    return NextResponse.json({ data: publicInvite, error: null }, { status: 201 });
  } catch (error) {
    if (error instanceof InviteValidationError) {
      return NextResponse.json(
        { data: null, error: { code: "VALIDATION_ERROR", message: error.message } },
        { status: 400 }
      );
    }
    if (error instanceof ClosedBetaGuestCapacityError) {
      return NextResponse.json(
        { data: null, error: { code: "GUEST_CAPACITY_REACHED", message: "This workspace has no available guest slots" } },
        { status: 409 },
      );
    }
    if (error instanceof ClosedBetaInactiveError) {
      return NextResponse.json(
        { data: null, error: { code: "BETA_INACTIVE", message: "This workspace is not accepting new guests" } },
        { status: 409 },
      );
    }
    console.error("Invite creation failed:", error);
    return NextResponse.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 }
    );
  }
}
