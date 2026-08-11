import { prisma, withTenant } from "../../../prisma/client";
import type { Prisma } from "@prisma/client";
import {
  normalizePermissions,
  sanitizePermissions,
  type ScopedPermission,
} from "./permissions";
import { DEFAULT_WORKSPACE_ID } from "../tenant";

export class RoleValidationError extends Error {}

export interface RoleInput {
  name?: string;
  permissions?: ScopedPermission[];
}

export async function listRoles() {
  return withTenant(DEFAULT_WORKSPACE_ID, async () => {
    const roles = await prisma.role.findMany({
      where: { tenantId: DEFAULT_WORKSPACE_ID },
      include: { _count: { select: { profiles: true } } },
      orderBy: [{ isAdmin: "desc" }, { name: "asc" }],
    });
    const workspace = await prisma.workspace.findUnique({
      where: { id: DEFAULT_WORKSPACE_ID },
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

export async function getRole(roleId: string) {
  return withTenant(DEFAULT_WORKSPACE_ID, async () => {
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

export async function createRole(input: RoleInput) {
  if (!input.name || !input.name.trim()) {
    throw new RoleValidationError("A role name is required");
  }
  const name = input.name.trim();
  const permissions = sanitizePermissions(input.permissions);
  try {
    return await withTenant(DEFAULT_WORKSPACE_ID, () =>
      prisma.role.create({
        data: {
          name,
          permissions: permissions as unknown as Prisma.InputJsonValue,
          tenantId: DEFAULT_WORKSPACE_ID,
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

export async function updateRole(roleId: string, input: RoleInput) {
  return withTenant(DEFAULT_WORKSPACE_ID, async () => {
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new RoleValidationError("Role not found");
    if (role.isAdmin) {
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

export async function deleteRole(roleId: string) {
  return withTenant(DEFAULT_WORKSPACE_ID, async () => {
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new RoleValidationError("Role not found");
    if (role.isAdmin) {
      throw new RoleValidationError("The Admin role cannot be deleted");
    }
    const workspace = await prisma.workspace.findUnique({
      where: { id: DEFAULT_WORKSPACE_ID },
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

export async function setDefaultRole(roleId: string | null) {
  return withTenant(DEFAULT_WORKSPACE_ID, async () => {
    if (roleId) {
      const role = await prisma.role.findUnique({ where: { id: roleId } });
      if (!role) throw new RoleValidationError("Role not found");
      if (role.isAdmin) {
        throw new RoleValidationError("The Admin role cannot be the default role");
      }
    }
    return prisma.workspace.upsert({
      where: { id: DEFAULT_WORKSPACE_ID },
      update: { defaultRoleId: roleId },
      create: {
        id: DEFAULT_WORKSPACE_ID,
        name: "Default",
        slug: "default",
        defaultRoleId: roleId,
      },
    });
  });
}

export async function assignRole(userId: string, roleId: string | null) {
  if (roleId) {
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new RoleValidationError("Role not found");
  }
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!profile) throw new RoleValidationError("User not found");

  return prisma.profile.update({
    where: { id: userId },
    data: { roleId },
  });
}

export async function listTeam() {
  const profiles = await prisma.profile.findMany({
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
  });
  return profiles;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}