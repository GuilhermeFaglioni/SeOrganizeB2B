import { prisma, withTenant } from "../../../prisma/client";
import type { Prisma, PrismaClient } from "@prisma/client";
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

type WorkspaceDb = PrismaClient | Prisma.TransactionClient;

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
  email: string,
  client: WorkspaceDb = prisma,
): Promise<string> {
  const base =
    slugify(name ?? "") || slugify(email.split("@")[0]) || "workspace";
  let slug = base;
  let suffix = 2;
  while (await client.workspace.findUnique({ where: { slug } })) {
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
  workspaceId: string,
  client: WorkspaceDb = prisma,
): Promise<{ adminRoleId: string; memberRoleId: string }> {
  return withTenant(workspaceId, async () => {
    const adminRole = await client.role.create({
      data: {
        name: "Admin",
        permissions: allScopedPermissions() as unknown as Prisma.InputJsonValue,
        isAdmin: true,
        tenantId: workspaceId,
      },
    });
    const memberRole = await client.role.create({
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

export async function createWorkspaceForUserWithPlan(
  name: string | null | undefined,
  email: string,
  planId: string,
  client: WorkspaceDb,
): Promise<WorkspaceSetup> {
  const slug = await generateUniqueSlug(name, email, client);
  const workspaceName = name ?? (email.split("@")[0] || "My Workspace");

  const workspace = await client.workspace.create({
    data: {
      name: workspaceName,
      slug,
      planId,
    },
  });

  const roles = await seedWorkspaceRoles(workspace.id, client);

  await client.workspace.update({
    where: { id: workspace.id },
    data: { defaultRoleId: roles.memberRoleId },
  });

  return { id: workspace.id, ...roles };
}

export async function createWorkspaceForUser(
  name: string | null | undefined,
  email: string
): Promise<WorkspaceSetup> {
  const slug = await generateUniqueSlug(name, email);
  const workspaceName = name ?? (email.split("@")[0] || "My Workspace");

  const workspace = await prisma.workspace.create({
    data: {
      name: workspaceName,
      slug,
      // New workspaces start locked: no plan until the owner pays via /plans.
      planId: null,
    },
  });

  const roles = await seedWorkspaceRoles(workspace.id);

  await prisma.workspace.update({
    where: { id: workspace.id },
    data: { defaultRoleId: roles.memberRoleId },
  });

  return { id: workspace.id, ...roles };
}

export interface ProfileWithWorkspaceInput {
  id: string;
  email: string;
  name: string;
}

/**
 * Creates a brand-new profile backed by a fresh (locked) workspace, with the
 * user as that workspace's Admin. This is the single source of truth for
 * onboarding: never connect a new user to a shared/default workspace.
 */
export async function createProfileWithWorkspace(
  input: ProfileWithWorkspaceInput
) {
  const workspace = await createWorkspaceForUser(input.name, input.email);
  return prisma.profile.create({
    data: {
      id: input.id,
      email: input.email,
      name: input.name,
      tenantId: workspace.id,
      roleId: workspace.adminRoleId,
    },
  });
}
