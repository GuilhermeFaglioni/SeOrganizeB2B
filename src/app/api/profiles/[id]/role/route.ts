import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { prisma, withTenant } from "../../../../../../prisma/client";
import { denyFor } from "@/lib/authz/authz";
import { mapRoleError, noWorkspaceResponse } from "@/lib/authz/http";
import { getTenantContext } from "@/lib/authz/tenant-context";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
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
      { data: null, error: { code: "FORBIDDEN", message: "Only admins can assign roles" } },
      { status: 403 }
    );
  }

  const body = await request.json();
  const roleId = body.roleId === null || body.roleId === undefined ? null : String(body.roleId);

  const target = await withTenant(ctx.tenantId, () =>
    prisma.profile.findUnique({
      where: { id: params.id },
      select: { id: true, tenantId: true },
    })
  );
  if (!target || target.tenantId !== ctx.tenantId) {
    return NextResponse.json(
      { data: null, error: { code: "NOT_FOUND", message: "Profile not found" } },
      { status: 404 }
    );
  }

  if (roleId) {
    const role = await withTenant(ctx.tenantId, () =>
      prisma.role.findUnique({ where: { id: roleId } })
    );
    if (!role || role.tenantId !== ctx.tenantId) {
      return NextResponse.json(
        { data: null, error: { code: "VALIDATION_ERROR", message: "Role not found" } },
        { status: 400 }
      );
    }
  }

  try {
    const profile = await withTenant(ctx.tenantId, () =>
      prisma.profile.update({
        where: { id: params.id },
        data: { roleId },
      })
    );
    return NextResponse.json({ data: profile, error: null });
  } catch (error) {
    return mapRoleError(error);
  }
}
