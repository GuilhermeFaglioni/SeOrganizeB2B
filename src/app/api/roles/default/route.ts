import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { denyFor } from "@/lib/authz/authz";
import { mapRoleError, noWorkspaceResponse } from "@/lib/authz/http";
import { setDefaultRole } from "@/lib/authz/roles-service";
import { getTenantContext } from "@/lib/authz/tenant-context";

export async function PATCH(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }
  const denied = await denyFor(user.id, "manage_roles");
  if (denied) return denied;

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

  const body = await request.json();
  const roleId = body.roleId === null || body.roleId === undefined ? null : String(body.roleId);
  if (!roleId && body.roleId !== null && body.roleId !== undefined) {
    return NextResponse.json(
      { data: null, error: { code: "VALIDATION_ERROR", message: "Invalid role" } },
      { status: 400 }
    );
  }

  try {
    const settings = await setDefaultRole(roleId, ctx.tenantId);
    return NextResponse.json({ data: settings, error: null });
  } catch (error) {
    return mapRoleError(error);
  }
}