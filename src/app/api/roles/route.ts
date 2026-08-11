import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { denyFor } from "@/lib/authz/authz";
import { mapRoleError, noWorkspaceResponse } from "@/lib/authz/http";
import { createRole, listRoles } from "@/lib/authz/roles-service";
import { sanitizePermissions } from "@/lib/authz/permissions";
import { getTenantContext } from "@/lib/authz/tenant-context";

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }
  const denied = await denyFor(user.id, "manage_roles");
  if (denied) return denied;

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

  const roles = await listRoles(ctx.tenantId);
  return NextResponse.json({ data: roles, error: null });
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }
  const denied = await denyFor(user.id, "manage_roles");
  if (denied) return denied;

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();
  if (!ctx.isAdmin) {
    return NextResponse.json(
      { data: null, error: { code: "FORBIDDEN", message: "Only admins can create roles" } },
      { status: 403 }
    );
  }

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json(
      { data: null, error: { code: "VALIDATION_ERROR", message: "A role name is required" } },
      { status: 400 }
    );
  }

  try {
    const role = await createRole(
      { name, permissions: sanitizePermissions(body.permissions) },
      ctx.tenantId
    );
    return NextResponse.json({ data: role, error: null }, { status: 201 });
  } catch (error) {
    return mapRoleError(error);
  }
}