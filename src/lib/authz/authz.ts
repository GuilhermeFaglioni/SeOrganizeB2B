import { NextResponse } from "next/server";
import { prisma, withTenant } from "../../../prisma/client";
import { isWorkspaceAccessBlocked } from "../tenant";
import {
  normalizePermissions,
  permissionKey,
  type PermissionScope,
  type ScopedPermission,
} from "./permissions";

export interface EffectivePermissions {
  tenantId: string | null;
  isAdmin: boolean;
  roleId: string | null;
  roleName: string | null;
  permissions: ScopedPermission[];
}

export interface PermissionRequest {
  resource: string;
  action: string;
  scope?: PermissionScope;
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
    permissions: normalizePermissions(role.permissions),
  };
}

function scopeCovers(
  granted: PermissionScope,
  requested: PermissionScope
): boolean {
  if (granted === "all") return true;
  if (granted === "area") return requested === "area" || requested === "project";
  return requested === "project";
}

function hasPermissionSync(
  effective: EffectivePermissions,
  permissionOrRequest: string | PermissionRequest
): boolean {
  if (effective.isAdmin) return true;
  const permissions = effective.permissions;
  if (typeof permissionOrRequest === "string") {
    return permissions.some(
      (permission) => permissionKey(permission) === permissionOrRequest
    );
  }
  const { resource, action, scope = "all" } = permissionOrRequest;
  return permissions.some(
    (permission) =>
      permission.resource === resource &&
      permission.action === action &&
      scopeCovers(permission.scope, scope)
  );
}

export function hasPermission(
  effective: EffectivePermissions,
  permission: string
): boolean;
export function hasPermission(
  effective: EffectivePermissions,
  request: PermissionRequest
): boolean;
export function hasPermission(
  userId: string,
  request: PermissionRequest
): Promise<boolean>;
export function hasPermission(
  effectiveOrUserId: EffectivePermissions | string,
  permissionOrRequest: string | PermissionRequest
): boolean | Promise<boolean> {
  if (typeof effectiveOrUserId === "string") {
    return getEffectivePermissions(effectiveOrUserId).then((effective) =>
      hasPermission(effective, permissionOrRequest as PermissionRequest)
    );
  }
  return hasPermissionSync(effectiveOrUserId, permissionOrRequest);
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