import { prisma, withTenant } from "../../../prisma/client";
import type { Prisma } from "@prisma/client";
import {
  allScopedPermissions,
  MODULES,
  type ScopedPermission,
} from "./permissions";

export interface WorkspaceSetup {
  id: string;
  adminRoleId: string;
  memberRoleId: string;
}

function slugify(value: string): string {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const slug = normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "workspace";
}

export async function generateUniqueSlug(
  name: string | null | undefined,
  email: string
): Promise<string> {
  const base =
    slugify(name ?? "") || slugify(email.split("@")[0]) || "workspace";
  let slug = base;
  let suffix = 2;
  while (await prisma.workspace.findUnique({ where: { slug } })) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
  return slug;
}

const MEMBER_MODULES = ["tasks", "projects", "calendar", "documents", "areas"];

function memberPermissions(): ScopedPermission[] {
  const permissions: ScopedPermission[] = [];
  for (const moduleName of MEMBER_MODULES) {
    for (const action of MODULES[moduleName]) {
      permissions.push({ resource: moduleName, action, scope: "area" });
    }
  }
  return permissions;
}

export async function seedWorkspaceRoles(
  workspaceId: string
): Promise<{ adminRoleId: string; memberRoleId: string }> {
  return withTenant(workspaceId, async () => {
    const adminRole = await prisma.role.create({
      data: {
        name: "Admin",
        permissions: allScopedPermissions() as unknown as Prisma.InputJsonValue,
        isAdmin: true,
        tenantId: workspaceId,
      },
    });
    const memberRole = await prisma.role.create({
      data: {
        name: "Member",
        permissions: memberPermissions() as unknown as Prisma.InputJsonValue,
        isAdmin: false,
        tenantId: workspaceId,
      },
    });
    return { adminRoleId: adminRole.id, memberRoleId: memberRole.id };
  });
}

export async function createWorkspaceForUser(
  name: string | null | undefined,
  email: string
): Promise<WorkspaceSetup> {
  const slug = await generateUniqueSlug(name, email);
  const workspaceName = name ?? (email.split("@")[0] || "My Workspace");
  const defaultPlan = await prisma.plan.findFirst({
    where: { isDefault: true, isActive: true },
  });

  const workspace = await prisma.workspace.create({
    data: {
      name: workspaceName,
      slug,
      planId: defaultPlan?.id ?? null,
    },
  });

  const roles = await seedWorkspaceRoles(workspace.id);

  await prisma.workspace.update({
    where: { id: workspace.id },
    data: { defaultRoleId: roles.memberRoleId },
  });

  return { id: workspace.id, ...roles };
}
