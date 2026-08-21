import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { denyFor, getEffectivePermissions } from "@/lib/authz/authz";
import {
  cancelInvite,
  getWorkspaceIdForUser,
  InviteNotFoundError,
  InviteValidationError,
} from "@/lib/invites/service";

export async function DELETE(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 },
    );
  }

  const denied = await denyFor(user.id, "manage_roles");
  if (denied) return denied;

  const permissions = await getEffectivePermissions(user.id);
  if (!permissions.isAdmin) {
    return NextResponse.json(
      {
        data: null,
        error: { code: "FORBIDDEN", message: "Only admins can cancel invites" },
      },
      { status: 403 },
    );
  }

  const workspaceId = await getWorkspaceIdForUser(user.id);
  if (!workspaceId) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: "VALIDATION_ERROR",
          message: "No workspace associated with this account",
        },
      },
      { status: 400 },
    );
  }

  try {
    const invite = await cancelInvite({
      inviteId: params.id,
      workspaceId,
      actor: { userId: user.id, email: user.email ?? "" },
    });
    const { token, ...publicInvite } = invite;
    void token;
    return NextResponse.json({ data: publicInvite, error: null });
  } catch (error) {
    if (error instanceof InviteNotFoundError) {
      return NextResponse.json(
        { data: null, error: { code: "NOT_FOUND", message: error.message } },
        { status: 404 },
      );
    }
    if (error instanceof InviteValidationError) {
      return NextResponse.json(
        { data: null, error: { code: "VALIDATION_ERROR", message: error.message } },
        { status: 400 },
      );
    }
    console.error("Invite cancellation failed:", error);
    return NextResponse.json(
      {
        data: null,
        error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
      },
      { status: 500 },
    );
  }
}
