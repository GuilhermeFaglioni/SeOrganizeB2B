import { prisma, withTenant } from "../../../prisma/client";
import type { Prisma } from "@prisma/client";
import {
  normalizePermissions,
  sanitizePermissions,
  type ScopedPermission,
} from "./permissions";

export class RoleValidationError extends Error {}

export interface RoleInput {
  name?: string;
  permissions?: ScopedPermission[];
}

export async function listRoles(tenantId: string) {
  return withTenant(tenantId, async () => {
    const roles = await prisma.role.findMany({
      where: { tenantId },
      include: { _count: { select: { profiles: true } } },
      orderBy: [{ isAdmin: "desc" }, { name: "asc" }],
    });
    const workspace = await prisma.workspace.findUnique({
      where: { id: tenantId },
      select: { defaultRoleId: true },
    });
    return roles.map((role) => ({
      id: role.id,
      name: role.name,
      tenantId: role.tenantId,
      permissions: normalizePermissions(role.permissions),
      isAdmin: role.isAdmin,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
      userCount: role._count.profiles,
      isDefault: workspace?.defaultRoleId === role.id,
    }));
  });
}

export async function getRole(roleId: string, tenantId: string) {
  return withTenant(tenantId, async () => {
    const role = await prisma.role.findUnique({
      where: { id: roleId },
      include: { _count: { select: { profiles: true } } },
    });
    if (!role) return null;
    return {
      id: role.id,
      name: role.name,
      tenantId: role.tenantId,
      permissions: normalizePermissions(role.permissions),
      isAdmin: role.isAdmin,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
      userCount: role._count.profiles,
    };
  });
}

export async function createRole(input: RoleInput, tenantId: string) {
  if (!input.name || !input.name.trim()) {
    throw new RoleValidationError("A role name is required");
  }
  const name = input.name.trim();
  const permissions = sanitizePermissions(input.permissions);
  try {
    return await withTenant(tenantId, () =>
      prisma.role.create({
        data: {
          name,
          permissions: permissions as unknown as Prisma.InputJsonValue,
          tenantId,
        },
      })
    );
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new RoleValidationError("A role with this name already exists");
    }
    throw error;
  }
}

export async function updateRole(
  roleId: string,
  input: RoleInput,
  tenantId: string
) {
  return withTenant(tenantId, async () => {
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new RoleValidationError("Role not found");
    if (role.isAdmin || role.name === "Admin") {
      throw new RoleValidationError("The Admin role cannot be edited");
    }

    const data: { name?: string; permissions?: ScopedPermission[] } = {};
    if (input.name !== undefined) {
      if (!input.name.trim()) throw new RoleValidationError("A role name is required");
      data.name = input.name.trim();
    }
    if (input.permissions !== undefined) {
      data.permissions = sanitizePermissions(input.permissions);
    }
    if (data.name === undefined && data.permissions === undefined) {
      throw new RoleValidationError("Nothing to update");
    }

    try {
      return await prisma.role.update({
        where: { id: roleId },
        data: {
          name: data.name,
          permissions: (
            data.permissions ?? normalizePermissions(role.permissions)
          ) as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new RoleValidationError("A role with this name already exists");
      }
      throw error;
    }
  });
}

export async function deleteRole(roleId: string, tenantId: string) {
  return withTenant(tenantId, async () => {
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new RoleValidationError("Role not found");
    if (role.isAdmin || role.name === "Admin") {
      throw new RoleValidationError("The Admin role cannot be deleted");
    }
    const workspace = await prisma.workspace.findUnique({
      where: { id: tenantId },
      select: { defaultRoleId: true },
    });
    if (workspace?.defaultRoleId === roleId) {
      throw new RoleValidationError(
        "This role is the default for new users. Choose another default role before deleting it."
      );
    }
    await prisma.role.delete({ where: { id: roleId } });
  });
}

export async function setDefaultRole(roleId: string | null, tenantId: string) {
  return withTenant(tenantId, async () => {
    if (roleId) {
      const role = await prisma.role.findUnique({ where: { id: roleId } });
      if (!role) throw new RoleValidationError("Role not found");
      if (role.isAdmin) {
        throw new RoleValidationError("The Admin role cannot be the default role");
      }
    }
    return prisma.workspace.upsert({
      where: { id: tenantId },
      update: { defaultRoleId: roleId },
      create: {
        id: tenantId,
        name: "Default",
        slug: "default",
        defaultRoleId: roleId,
      },
    });
  });
}

export async function assignRole(
  userId: string,
  roleId: string | null,
  tenantId: string
) {
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { id: true, tenantId: true },
  });
  if (!profile || profile.tenantId !== tenantId) {
    throw new RoleValidationError("User not found");
  }
  if (roleId) {
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role || role.tenantId !== tenantId) {
      throw new RoleValidationError("Role not found");
    }
  }

  return prisma.profile.update({
    where: { id: userId },
    data: { roleId },
  });
}

export async function listTeam(tenantId: string) {
  let ownerProfileId: string | null = null;
  try {
    const enrollment = await prisma.closedBetaEnrollment.findUnique({
      where: { workspaceId: tenantId },
      select: { ownerProfileId: true, status: true },
    });
    if (enrollment?.status === "active") ownerProfileId = enrollment.ownerProfileId;
  } catch {
    // The beta migration is optional for legacy workspaces.
  }

  const team = await withTenant(tenantId, () =>
    prisma.profile.findMany({
      where: { tenantId, removedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        roleId: true,
        role: { select: { id: true, name: true, isAdmin: true } },
        teamMemberAreas: {
          include: { area: { select: { id: true, name: true, color: true } } },
        },
      },
      orderBy: { name: "asc" },
    }),
  );
  return team.map((member) => ({
    ...member,
    isOwner: member.id === ownerProfileId,
  }));
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}
