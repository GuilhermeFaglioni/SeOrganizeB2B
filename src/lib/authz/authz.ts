import { NextResponse } from "next/server";
import { prisma, withTenant } from "../../../prisma/client";
import { isWorkspaceAccessBlocked } from "../tenant";

export interface EffectivePermissions {
  tenantId: string | null;
  isAdmin: boolean;
  roleId: string | null;
  roleName: string | null;
  permissions: string[];
}

export async function getEffectivePermissions(
  userId: string
): Promise<EffectivePermissions> {
  const profile = await prisma.profile.findFirst({
    where: { id: userId },
    select: {
      tenantId: true,
      role: {
        select: {
          id: true,
          name: true,
          isAdmin: true,
          permissions: true,
          tenantId: true,
        },
      },
    },
  });

  const roleApplies = (role: { tenantId: string } | null) =>
    role !== null && role.tenantId === profile?.tenantId;

  let role = profile?.role ?? null;
  if (role && !roleApplies(role)) role = null;

  if (!role) {
    if (profile?.tenantId) {
      const workspace = await prisma.workspace.findUnique({
        where: { id: profile.tenantId },
        select: { defaultRoleId: true },
      });
      const defaultRoleId = workspace?.defaultRoleId ?? null;
      if (defaultRoleId) {
        const fallback = await withTenant(profile.tenantId, () =>
          prisma.role.findFirst({
            where: { id: defaultRoleId, tenantId: profile.tenantId! },
            select: {
              id: true,
              name: true,
              isAdmin: true,
              permissions: true,
              tenantId: true,
            },
          })
        );
        if (fallback && roleApplies(fallback)) {
          role = fallback;
        }
      }
    }
  }

  if (!role) {
    return {
      tenantId: profile?.tenantId ?? null,
      isAdmin: false,
      roleId: null,
      roleName: null,
      permissions: [],
    };
  }

  if (role.isAdmin) {
    return {
      tenantId: profile?.tenantId ?? null,
      isAdmin: true,
      roleId: role.id,
      roleName: role.name,
      permissions: [],
    };
  }

  return {
    tenantId: profile?.tenantId ?? null,
    isAdmin: false,
    roleId: role.id,
    roleName: role.name,
    permissions: (role.permissions ?? []) as string[],
  };
}

export function hasPermission(
  effective: EffectivePermissions,
  permission: string
): boolean {
  if (effective.isAdmin) return true;
  return effective.permissions.includes(permission);
}

export async function can(
  userId: string,
  permission: string
): Promise<boolean> {
  const effective = await getEffectivePermissions(userId);
  return hasPermission(effective, permission);
}

export async function denyFor(
  userId: string,
  permission: string
): Promise<NextResponse | null> {
  const effective = await getEffectivePermissions(userId);
  if (!hasPermission(effective, permission)) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: "FORBIDDEN",
          message: "You do not have permission to perform this action",
        },
      },
      { status: 403 }
    );
  }
  if (effective.tenantId) {
    const workspace = await prisma.workspace.findUnique({
      where: { id: effective.tenantId },
      select: { status: true, cancelledAt: true },
    });
    if (
      workspace &&
      isWorkspaceAccessBlocked({
        status: workspace.status,
        cancelledAt: workspace.cancelledAt,
      })
    ) {
      return NextResponse.json(
        {
          data: null,
          error: {
            code: "WORKSPACE_CANCELLED",
            message: "This workspace has been cancelled",
          },
        },
        { status: 403 }
      );
    }
  }
  return null;
}
