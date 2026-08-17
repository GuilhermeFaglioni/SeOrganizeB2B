import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma, withTenant } from "../../../prisma/client";
import { verifyBindingCode } from "./binding-code";
import type { WorkspaceOnboardingState } from "../onboarding/types";
import {
  assertClosedBetaGuestSlot,
  recordClosedBetaAudit,
  type ClosedBetaActor,
} from "../closed-beta/service";

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const BINDING_ATTEMPT_LIMIT = 5;
export const BINDING_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
export const BINDING_ATTEMPT_RETENTION_MS = 24 * 60 * 60 * 1000;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class InviteValidationError extends Error {}
export class InviteNotFoundError extends Error {}
export class InviteAlreadyMemberError extends Error {}

export type { WorkspaceOnboardingState } from "../onboarding/types";

export class OnboardingRequiredError extends Error {
  constructor(readonly state: Exclude<WorkspaceOnboardingState, { status: "ready" }>) {
    super("Workspace onboarding requires another step");
  }
}

export class BindingCodeInvalidError extends Error {
  constructor() {
    super("The binding code could not be verified");
  }
}

export class BindingCodeRateLimitError extends Error {
  constructor(readonly retryAt: Date) {
    super("Too many binding code attempts");
  }
}

export class BindingCodeAmbiguousError extends BindingCodeInvalidError {}

export interface CreateInviteInput {
  workspaceId: string;
  email: string;
  roleId?: string | null;
  actor?: ClosedBetaActor;
}

export interface CancelInviteInput {
  inviteId: string;
  workspaceId: string;
  actor?: ClosedBetaActor;
}

export interface UserOnboardingInput {
  userId: string;
  email: string;
}

export interface BindUserInput extends UserOnboardingInput {
  bindingCode: string;
  name?: string | null;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

async function expireInvites(where: { email?: string; workspaceId?: string }) {
  await prisma.invite.updateMany({
    where: {
      ...where,
      status: "pending",
      expiresAt: { lt: new Date() },
    },
    data: { status: "expired" },
  });
}

async function cleanupBindingAttempts() {
  await prisma.workspaceBindingAttempt.deleteMany({
    where: {
      updatedAt: { lt: new Date(Date.now() - BINDING_ATTEMPT_RETENTION_MS) },
    },
  });
}

export async function getWorkspaceIdForUser(
  userId: string
): Promise<string | null> {
  const profile = await prisma.profile.findFirst({
    where: { id: userId, removedAt: null },
    select: { tenantId: true },
  });
  return profile?.tenantId ?? null;
}

export async function getOnboardingStatus(
  input: UserOnboardingInput
): Promise<WorkspaceOnboardingState> {
  const email = normalizeEmail(input.email);
  const existingProfile = await prisma.profile.findUnique({
    where: { id: input.userId },
    select: { id: true },
  });
  if (existingProfile) return { status: "ready" };
  if (!email) return { status: "workspace_creation_required" };

  await expireInvites({ email });
  const invites = await prisma.invite.findMany({
    where: { email, status: { in: ["pending", "expired"] } },
    select: {
      status: true,
      workspace: { select: { bindingCodeHash: true } },
    },
  });
  const pendingInvites = invites.filter((invite) => invite.status === "pending");
  if (pendingInvites.length > 0) {
    if (pendingInvites.some((invite) => !invite.workspace.bindingCodeHash)) {
      return { status: "binding_setup_required" };
    }
    return { status: "binding_required", reason: "pending_invite" };
  }
  if (invites.some((invite) => invite.status === "expired")) {
    return { status: "binding_required", reason: "expired_invite" };
  }
  return { status: "workspace_creation_required" };
}

export async function createInvite(input: CreateInviteInput) {
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) {
    throw new InviteValidationError("A valid email is required");
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: input.workspaceId },
    select: {
      id: true,
      name: true,
      defaultRoleId: true,
      bindingCodeHash: true,
    },
  });
  if (!workspace) {
    throw new InviteValidationError("Workspace not found");
  }
  if (!workspace.bindingCodeHash) {
    throw new InviteValidationError(
      "Configure a workspace binding code before inviting collaborators"
    );
  }

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

  const existingProfile = await prisma.profile.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, tenantId: true },
  });
  if (existingProfile) {
    if (existingProfile.tenantId === input.workspaceId) {
      throw new InviteValidationError("This email is already a member");
    }
    throw new InviteValidationError(
      "This email already belongs to another workspace"
    );
  }

  await expireInvites({ workspaceId: input.workspaceId });
  const pendingInvite = await prisma.invite.findFirst({
    where: { workspaceId: input.workspaceId, email, status: "pending" },
    select: { id: true },
  });
  if (pendingInvite) {
    throw new InviteValidationError("This email has already been invited");
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  const persist = async (client: Prisma.TransactionClient | typeof prisma) => {
    const betaCapacity = await assertClosedBetaGuestSlot(
      client as Prisma.TransactionClient,
      input.workspaceId,
    );
    const created = await client.invite.create({
      data: {
        workspaceId: input.workspaceId,
        email,
        roleId,
        token,
        expiresAt,
        status: "pending",
      },
    });
    if (betaCapacity && input.actor) {
      await recordClosedBetaAudit(client, {
        actor: input.actor,
        action: "guest_invitation.created",
        targetType: "invite",
        targetId: created.id,
        afterValue: { workspaceId: input.workspaceId, email, roleId },
      });
    }
    return created;
  };

  const transaction = (prisma as unknown as { $transaction?: unknown }).$transaction;
  if (typeof transaction === "function") {
    return prisma.$transaction(async (client) => {
      await client.invite.updateMany({
        where: { workspaceId: input.workspaceId, status: "pending", expiresAt: { lt: new Date() } },
        data: { status: "expired" },
      });
      const existingProfileInTransaction = await client.profile.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        select: { id: true, tenantId: true },
      });
      if (existingProfileInTransaction) {
        if (existingProfileInTransaction.tenantId === input.workspaceId) {
          throw new InviteValidationError("This email is already a member");
        }
        throw new InviteValidationError("This email already belongs to another workspace");
      }
      const pendingInTransaction = await client.invite.findFirst({
        where: { workspaceId: input.workspaceId, email, status: "pending" },
        select: { id: true },
      });
      if (pendingInTransaction) {
        throw new InviteValidationError("This email has already been invited");
      }
      return persist(client);
    });
  }
  return persist(prisma);
}

export async function listInvites(workspaceId: string) {
  await expireInvites({ workspaceId });
  const invites = await prisma.invite.findMany({
    where: { workspaceId, status: { in: ["pending", "expired"] } },
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

export async function cancelInvite(input: CancelInviteInput) {
  const invite = await prisma.invite.findUnique({
    where: { id: input.inviteId },
    select: { id: true, workspaceId: true, status: true },
  });
  if (!invite || invite.workspaceId !== input.workspaceId) {
    throw new InviteNotFoundError("Invite not found");
  }
  if (invite.status !== "pending" && invite.status !== "expired") {
    throw new InviteValidationError("This invite can no longer be cancelled");
  }
  try {
    const cancelled = await prisma.invite.update({
      where: {
        id: invite.id,
        status: { in: ["pending", "expired"] },
      },
      data: { status: "cancelled" },
    });
    if (input.actor) {
      try {
        const enrollment = await prisma.closedBetaEnrollment.findUnique({
          where: { workspaceId: input.workspaceId },
          select: { id: true },
        });
        if (enrollment) {
          await recordClosedBetaAudit(prisma, {
            actor: input.actor,
            action: "guest_invitation.cancelled",
            targetType: "invite",
            targetId: invite.id,
            afterValue: { workspaceId: input.workspaceId, status: cancelled.status },
          });
        }
      } catch {
        // The beta tables are introduced by a later migration; legacy invites
        // remain cancellable before that migration is deployed.
      }
    }
    return cancelled;
  } catch (error) {
    if (isRecordNotFound(error)) {
      throw new InviteValidationError("This invite can no longer be cancelled");
    }
    throw error;
  }
}

async function getPendingInvitesForUser(email: string) {
  await expireInvites({ email });
  return prisma.invite.findMany({
    where: { email, status: "pending" },
    select: {
      id: true,
      email: true,
      workspaceId: true,
      roleId: true,
      expiresAt: true,
      workspace: {
        select: { bindingCodeHash: true, defaultRoleId: true },
      },
    },
  });
}

async function blockBindingAttempts(
  userId: string,
  windowStartedAt: Date,
  now: Date,
) {
  const blockedUntil = new Date(
    windowStartedAt.getTime() + BINDING_ATTEMPT_WINDOW_MS,
  );
  await prisma.workspaceBindingAttempt.update({
    where: { userId },
    data: { blockedUntil, updatedAt: now },
  });
  return blockedUntil;
}

async function reserveBindingAttempt(userId: string): Promise<Date | null> {
  const now = new Date();
  const windowStartedAt = new Date(now.getTime() - BINDING_ATTEMPT_WINDOW_MS);

  // Create the row without overwriting an existing counter. The conditional
  // increment below is atomic, so concurrent invalid requests cannot pass the
  // limit between a read and a write.
  await prisma.workspaceBindingAttempt.upsert({
    where: { userId },
    create: {
      userId,
      attemptCount: 0,
      windowStartedAt: now,
    },
    update: { updatedAt: now },
  });

  let incremented = await prisma.workspaceBindingAttempt.updateMany({
    where: {
      userId,
      windowStartedAt: { gte: windowStartedAt },
      attemptCount: { lt: BINDING_ATTEMPT_LIMIT },
    },
    data: {
      attemptCount: { increment: 1 },
      updatedAt: now,
    },
  });

  if (incremented.count === 0) {
    const reset = await prisma.workspaceBindingAttempt.updateMany({
      where: { userId, windowStartedAt: { lt: windowStartedAt } },
      data: {
        attemptCount: 1,
        windowStartedAt: now,
        blockedUntil: null,
        updatedAt: now,
      },
    });
    if (reset.count === 0) {
      incremented = await prisma.workspaceBindingAttempt.updateMany({
        where: {
          userId,
          windowStartedAt: { gte: windowStartedAt },
          attemptCount: { lt: BINDING_ATTEMPT_LIMIT },
        },
        data: {
          attemptCount: { increment: 1 },
          updatedAt: now,
        },
      });
    }
  }

  if (incremented.count === 0) {
    const current = await prisma.workspaceBindingAttempt.findUnique({
      where: { userId },
    });
    if (current && current.attemptCount >= BINDING_ATTEMPT_LIMIT) {
      throw new BindingCodeRateLimitError(
        await blockBindingAttempts(userId, current.windowStartedAt, now),
      );
    }
    return null;
  }

  const current = await prisma.workspaceBindingAttempt.findUnique({
    where: { userId },
  });
  if (current && current.attemptCount >= BINDING_ATTEMPT_LIMIT) {
    return blockBindingAttempts(userId, current.windowStartedAt, now);
  }
  return null;
}

async function clearBindingAttempts(userId: string) {
  await prisma.workspaceBindingAttempt.delete({ where: { userId } }).catch(() => undefined);
}

export async function bindUserToWorkspace(input: BindUserInput) {
  const email = normalizeEmail(input.email);
  const state = await getOnboardingStatus({ userId: input.userId, email });
  if (state.status === "ready") {
    const profile = await prisma.profile.findUnique({
      where: { id: input.userId },
    });
    if (profile) return { profile, invite: null };
    throw new InviteAlreadyMemberError("This account is already linked");
  }
  if (
    state.status !== "binding_required" ||
    state.reason !== "pending_invite"
  ) {
    throw new OnboardingRequiredError(state);
  }

  await cleanupBindingAttempts();
  const invites = await getPendingInvitesForUser(email);
  if (invites.some((invite) => !invite.workspace.bindingCodeHash)) {
    throw new OnboardingRequiredError({ status: "binding_setup_required" });
  }

  const blockedUntil = await reserveBindingAttempt(input.userId);
  const matches = [];
  for (const invite of invites) {
    if (
      invite.workspace.bindingCodeHash &&
      (await verifyBindingCode(input.bindingCode, invite.workspace.bindingCodeHash))
    ) {
      matches.push(invite);
    }
  }

  if (matches.length !== 1) {
    if (blockedUntil) {
      throw new BindingCodeRateLimitError(blockedUntil);
    }
    if (matches.length > 1) throw new BindingCodeAmbiguousError();
    throw new BindingCodeInvalidError();
  }

  const selected = matches[0];
  let result;
  try {
    result = await prisma.$transaction(async (transaction) => {
      const existingProfile = await transaction.profile.findUnique({
        where: { id: input.userId },
        select: { id: true, tenantId: true },
      });
      if (existingProfile) {
        throw new InviteAlreadyMemberError("This account is already linked");
      }

      const invite = await transaction.invite.findUnique({
        where: { id: selected.id },
        select: {
          id: true,
          email: true,
          workspaceId: true,
          roleId: true,
          status: true,
          expiresAt: true,
          workspace: {
            select: { bindingCodeHash: true, defaultRoleId: true },
          },
        },
      });
      if (
        !invite ||
        invite.status !== "pending" ||
        invite.expiresAt.getTime() < Date.now()
      ) {
        throw new InviteNotFoundError("Invite not found or no longer valid");
      }
      if (
        !invite.workspace.bindingCodeHash ||
        !(await verifyBindingCode(input.bindingCode, invite.workspace.bindingCodeHash))
      ) {
        throw new BindingCodeInvalidError();
      }

      await assertClosedBetaGuestSlot(transaction, invite.workspaceId, invite.id);

      const profile = await transaction.profile.create({
        data: {
          id: input.userId,
          email: invite.email,
          name: input.name?.trim() || null,
          tenantId: invite.workspaceId,
          roleId: invite.roleId ?? invite.workspace.defaultRoleId ?? null,
        },
      });
      let accepted;
      try {
        accepted = await transaction.invite.update({
          where: { id: invite.id, status: "pending" },
          data: { status: "accepted", acceptedAt: new Date() },
        });
      } catch (error) {
        if (isRecordNotFound(error)) {
          throw new InviteNotFoundError("Invite not found or no longer valid");
        }
        throw error;
      }
      await transaction.invite.updateMany({
        where: {
          email,
          status: "pending",
          id: { not: invite.id },
        },
        data: { status: "superseded" },
      });

      return { profile, invite: accepted };
    });
  } catch (error) {
    if (!(error instanceof InviteAlreadyMemberError) && !isUniqueViolation(error)) {
      throw error;
    }

    // A concurrent request may have created this profile after both requests
    // passed the pre-transaction onboarding check. Reuse that result instead
    // of turning a successful binding into a 500 response.
    const existingProfile = await prisma.profile.findUnique({
      where: { id: input.userId },
    });
    if (!existingProfile) throw error;
    result = { profile: existingProfile, invite: null };
  }

  await clearBindingAttempts(input.userId);
  return result;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

function isRecordNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2025"
  );
}
