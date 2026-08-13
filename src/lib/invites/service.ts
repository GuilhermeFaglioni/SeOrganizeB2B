import { randomBytes } from "node:crypto";
import { prisma, withTenant } from "../../../prisma/client";
import { sendInviteEmail } from "./email";

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class InviteValidationError extends Error {}
export class InviteNotFoundError extends Error {}
export class InviteAlreadyMemberError extends Error {}

export interface CreateInviteInput {
  workspaceId: string;
  email: string;
  roleId?: string | null;
}

export async function getWorkspaceIdForUser(
  userId: string
): Promise<string | null> {
  const profile = await prisma.profile.findFirst({
    where: { id: userId },
    select: { tenantId: true },
  });
  return profile?.tenantId ?? null;
}

export async function createInvite(input: CreateInviteInput) {
  const email = input.email.trim().toLowerCase();
  if (!EMAIL_REGEX.test(email)) {
    throw new InviteValidationError("A valid email is required");
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: input.workspaceId },
    select: { id: true, name: true, defaultRoleId: true },
  });
  if (!workspace) {
    throw new InviteValidationError("Workspace not found");
  }

  // Auto-fill from workspace default role when caller omits roleId
  const roleId: string | null = input.roleId ?? workspace.defaultRoleId ?? null;
  if (roleId) {
    const role = await withTenant(input.workspaceId, () =>
      prisma.role.findFirst({
        where: { id: roleId, tenantId: input.workspaceId },
        select: { id: true },
      })
    );
    if (!role) {
      throw new InviteValidationError("Role not found in this workspace");
    }
  }

  const existingMember = await prisma.profile.findFirst({
    where: { email, tenantId: input.workspaceId },
    select: { id: true },
  });
  if (existingMember) {
    throw new InviteValidationError("This email is already a member");
  }

  const pendingInvite = await prisma.invite.findFirst({
    where: { workspaceId: input.workspaceId, email, status: "pending" },
    select: { id: true },
  });
  if (pendingInvite) {
    throw new InviteValidationError("This email has already been invited");
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  const invite = await prisma.invite.create({
    data: {
      workspaceId: input.workspaceId,
      email,
      roleId,
      token,
      expiresAt,
      status: "pending",
    },
  });

  await sendInviteEmail(invite, workspace);
  return invite;
}

export async function listInvites(workspaceId: string) {
  const invites = await prisma.invite.findMany({
    where: { workspaceId, status: "pending" },
    orderBy: { createdAt: "desc" },
  });
  return invites.map((invite) => ({
    id: invite.id,
    email: invite.email,
    status: invite.status,
    roleId: invite.roleId,
    createdAt: invite.createdAt,
    expiresAt: invite.expiresAt,
  }));
}

export async function acceptInvite(inviteId: string) {
  const invite = await prisma.invite.findUnique({ where: { id: inviteId } });
  if (!invite || invite.status !== "pending") {
    throw new InviteNotFoundError("Invite not found or no longer valid");
  }
  if (invite.expiresAt.getTime() < Date.now()) {
    throw new InviteNotFoundError("Invite has expired");
  }

  const existingMember = await prisma.profile.findFirst({
    where: { email: invite.email, tenantId: invite.workspaceId },
    select: { id: true },
  });
  if (existingMember) {
    throw new InviteAlreadyMemberError(
      "This email already has an account in the workspace. Please log in instead."
    );
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: invite.workspaceId },
    select: { defaultRoleId: true },
  });
  const roleId = invite.roleId ?? workspace?.defaultRoleId ?? null;

  const profile = await prisma.profile.create({
    data: {
      email: invite.email,
      tenantId: invite.workspaceId,
      roleId,
    },
  });

  const accepted = await prisma.invite.update({
    where: { id: inviteId },
    data: { status: "accepted", acceptedAt: new Date() },
  });

  return { profile, invite: accepted };
}