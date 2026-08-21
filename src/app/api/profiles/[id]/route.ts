import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { denyFor } from "@/lib/authz/authz";
import { getTenantContext } from "@/lib/authz/tenant-context";
import { noWorkspaceResponse } from "@/lib/authz/http";
import {
  ClosedBetaMemberError,
  removeClosedBetaMember,
} from "@/lib/closed-beta/service";

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
  const context = await getTenantContext(user.id);
  if (!context.tenantId) return noWorkspaceResponse();
  if (!context.isAdmin) {
    return NextResponse.json(
      { data: null, error: { code: "FORBIDDEN", message: "Only admins can remove members" } },
      { status: 403 },
    );
  }

  try {
    const member = await removeClosedBetaMember(context.tenantId, params.id, {
      userId: user.id,
      email: user.email ?? "",
    });
    return NextResponse.json({ data: member, error: null });
  } catch (error) {
    if (error instanceof ClosedBetaMemberError) {
      return NextResponse.json(
        { data: null, error: { code: "VALIDATION_ERROR", message: error.message } },
        { status: 400 },
      );
    }
    console.error("Closed Beta member removal failed:", error);
    return NextResponse.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Unexpected error" } },
      { status: 500 },
    );
  }
}
