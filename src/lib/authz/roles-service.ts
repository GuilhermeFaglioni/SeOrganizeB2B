import { prisma } from "../../../prisma/client";
import { sanitizePermissions } from "./permissions";

export class RoleValidationError extends Error {}

export interface RoleInput {
  name?: string;
  permissions?: string[];
}

export async function listRoles() {
  const roles = await prisma.role.findMany({
    include: { _count: { select: { profiles: true } } },
    orderBy: [{ isAdmin: "desc" }, { name: "asc" }],
  });
  const workspace = await prisma.workspaceSettings.findUnique({
    where: { id: "default" },
    select: { defaultRoleId: true },
  });
  return roles.map((role) => ({
    id: role.id,
    name: role.name,
    tenantId: role.tenantId,
    permissions: role.permissions as string[],
    isAdmin: role.isAdmin,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
    userCount: role._count.profiles,
    isDefault: workspace?.defaultRoleId === role.id,
  }));
}

export async function getRole(roleId: string) {
  const role = await prisma.role.findUnique({
    where: { id: roleId },
    include: { _count: { select: { profiles: true } } },
  });
  if (!role) return null;
  return {
    id: role.id,
    name: role.name,
    tenantId: role.tenantId,
    permissions: role.permissions as string[],
    isAdmin: role.isAdmin,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
    userCount: role._count.profiles,
  };
}

export async function createRole(input: RoleInput) {
  if (!input.name || !input.name.trim()) {
    throw new RoleValidationError("A role name is required");
  }
  const permissions = sanitizePermissions(input.permissions);
  try {
    return await prisma.role.create({
      data: { name: input.name.trim(), permissions },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new RoleValidationError("A role with this name already exists");
    }
    throw error;
  }
}

export async function updateRole(roleId: string, input: RoleInput) {
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) throw new RoleValidationError("Role not found");
  if (role.isAdmin) {
    throw new RoleValidationError("The Admin role cannot be edited");
  }

  const data: { name?: string; permissions?: string[] } = {};
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
        permissions:
          data.permissions ?? (role.permissions as string[]),
      },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new RoleValidationError("A role with this name already exists");
    }
    throw error;
  }
}

export async function deleteRole(roleId: string) {
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) throw new RoleValidationError("Role not found");
  if (role.isAdmin) {
    throw new RoleValidationError("The Admin role cannot be deleted");
  }
  const workspace = await prisma.workspaceSettings.findUnique({
    where: { id: "default" },
    select: { defaultRoleId: true },
  });
  if (workspace?.defaultRoleId === roleId) {
    throw new RoleValidationError(
      "This role is the default for new users. Choose another default role before deleting it."
    );
  }
  await prisma.role.delete({ where: { id: roleId } });
}

export async function setDefaultRole(roleId: string | null) {
  if (roleId) {
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new RoleValidationError("Role not found");
    if (role.isAdmin) {
      throw new RoleValidationError("The Admin role cannot be the default role");
    }
  }
  return prisma.workspaceSettings.upsert({
    where: { id: "default" },
    update: { defaultRoleId: roleId },
    create: { id: "default", defaultRoleId: roleId },
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
