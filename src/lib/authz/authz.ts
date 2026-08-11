import { NextResponse } from "next/server";
import { prisma, withTenant, withTenantBypass } from "../../../prisma/client";
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

const ENTITY_TYPE_RESOURCE: Record<string, string> = {
  task: "tasks",
  project: "projects",
  document: "documents",
  area: "areas",
  contract: "financial.contracts",
  client: "financial.clients",
  proposal: "financial.proposals",
  receivable: "financial.receivables",
  overview: "financial.overview",
};

/**
 * Financial entities have no `areaId`/`projectId` in the schema, so area/project
 * scopes cannot be resolved for them. Access is granted whenever the user holds
 * the module's `view` permission (tenant-level scope).
 */
const TENANT_SCOPED_ENTITY_TYPES: ReadonlySet<string> = new Set([
  "contract",
  "client",
  "proposal",
  "receivable",
  "overview",
]);

/**
 * Area memberships for a user, scoped to their tenant via `team_member_areas`.
 */
export async function getUserAreaIds(
  userId: string,
  tenantId: string | null
): Promise<string[]> {
  if (!tenantId) return [];
  const rows = await withTenant(tenantId, () =>
    prisma.teamMemberArea.findMany({
      where: { userId },
      select: { areaId: true },
    })
  );
  return rows.map((row) => row.areaId);
}

/**
 * Project memberships for a user via `project_members`. The join table has no
 * `tenantId` column, so it bypasses the tenant filter and is scoped through the
 * `project` relation instead.
 */
export async function getUserProjectIds(
  userId: string,
  tenantId: string | null
): Promise<string[]> {
  if (!tenantId) return [];
  const rows = await withTenantBypass(() =>
    prisma.projectMember.findMany({
      where: { profileId: userId, project: { tenantId } },
      select: { projectId: true },
    })
  );
  return rows.map((row) => row.projectId);
}

async function resolveAreaId(
  entityType: string,
  entityId: string,
  tenantId: string | null
): Promise<string | null> {
  if (!tenantId) return null;
  switch (entityType) {
    case "area":
      return entityId;
    case "project":
      return (
        (await withTenant(tenantId, () =>
          prisma.project.findUnique({
            where: { id: entityId },
            select: { areaId: true },
          })
        ))?.areaId ?? null
      );
    case "task":
      return (
        (await withTenant(tenantId, () =>
          prisma.task.findUnique({
            where: { id: entityId },
            select: { project: { select: { areaId: true } } },
          })
        ))?.project?.areaId ?? null
      );
    case "document":
      return (
        (await withTenant(tenantId, () =>
          prisma.document.findUnique({
            where: { id: entityId },
            select: { project: { select: { areaId: true } } },
          })
        ))?.project?.areaId ?? null
      );
    default:
      return null;
  }
}

async function resolveProjectId(
  entityType: string,
  entityId: string,
  tenantId: string | null
): Promise<string | null> {
  if (!tenantId) return null;
  switch (entityType) {
    case "project":
      return entityId;
    case "task":
      return (
        (await withTenant(tenantId, () =>
          prisma.task.findUnique({
            where: { id: entityId },
            select: { projectId: true },
          })
        ))?.projectId ?? null
      );
    case "document":
      return (
        (await withTenant(tenantId, () =>
          prisma.document.findUnique({
            where: { id: entityId },
            select: { projectId: true },
          })
        ))?.projectId ?? null
      );
    default:
      return null;
  }
}

/**
 * Verifies whether a user can view a specific resource, honouring the scope of
 * their `view` permission for the resource's module.
 *
 * - `all`: permission alone grants access.
 * - `area`: the resource's area must be one of the user's `team_member_areas`.
 * - `project`: the resource's project must be one of the user's `project_members`.
 * - No `view` permission (or an unknown entity type): denied.
 * - Admin bypass: `isAdmin` users can view everything.
 */
export async function canViewResource(
  userId: string,
  entityType: string,
  entityId: string
): Promise<boolean> {
  const effective = await getEffectivePermissions(userId);
  if (effective.isAdmin) return true;
  const resource = ENTITY_TYPE_RESOURCE[entityType];
  if (!resource) return false;
  const permission = effective.permissions.find(
    (p) => p.resource === resource && p.action === "view"
  );
  if (!permission) return false;
  // Financial entities have no area/project linkage in the schema, so the view
  // permission alone grants access (tenant-level scope).
  if (TENANT_SCOPED_ENTITY_TYPES.has(entityType)) return true;
  const { tenantId } = effective;
  if (permission.scope === "all") return true;
  if (permission.scope === "area") {
    const [areaIds, areaId] = await Promise.all([
      getUserAreaIds(userId, tenantId),
      resolveAreaId(entityType, entityId, tenantId),
    ]);
    return areaId !== null && areaIds.includes(areaId);
  }
  if (permission.scope === "project") {
    const [projectIds, projectId] = await Promise.all([
      getUserProjectIds(userId, tenantId),
      resolveProjectId(entityType, entityId, tenantId),
    ]);
    return projectId !== null && projectIds.includes(projectId);
  }
  return false;
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