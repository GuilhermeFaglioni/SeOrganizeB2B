import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { prisma } from "../../../../../../prisma/client";
import { denyFor, getEffectivePermissions } from "@/lib/authz/authz";
import { mapRoleError } from "@/lib/authz/http";
import { assignRole } from "@/lib/authz/roles-service";

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

  const body = await request.json();
  const roleId = body.roleId === null || body.roleId === undefined ? null : String(body.roleId);

  // Assigning the Admin role is reserved for admins.
  if (roleId) {
    const target = await prisma.role.findUnique({ where: { id: roleId } });
    if (!target) {
      return NextResponse.json(
        { data: null, error: { code: "VALIDATION_ERROR", message: "Role not found" } },
        { status: 400 }
      );
    }
    if (target.isAdmin) {
      const effective = await getEffectivePermissions(user.id);
      if (!effective.isAdmin) {
        return NextResponse.json(
          { data: null, error: { code: "FORBIDDEN", message: "Only admins can assign the Admin role" } },
          { status: 403 }
        );
      }
    }
  }

  try {
    const profile = await assignRole(params.id, roleId);
    return NextResponse.json({ data: profile, error: null });
  } catch (error) {
    return mapRoleError(error);
  }
}
