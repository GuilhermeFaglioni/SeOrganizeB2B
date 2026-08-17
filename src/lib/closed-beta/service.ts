import { createHash } from "node:crypto";
import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../prisma/client";
import { createWorkspaceForUserWithPlan } from "../authz/workspace-setup";

export const CLOSED_BETA_CONFIG_ID = "default";
export const CLOSED_BETA_PLAN_ID = "00000000-0000-0000-0000-00000000cb01";
export const CLOSED_BETA_PLAN_NAME = "Closed Beta";
export const CLOSED_BETA_DEFAULT_MAX_PRIMARY_WORKSPACES = 30;
export const CLOSED_BETA_DEFAULT_MAX_GUESTS_PER_WORKSPACE = 3;
export const CLOSED_BETA_INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const CLOSED_BETA_INVITATION_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
export const CLOSED_BETA_AUDIT_RETENTION_MS = 2 * 365 * 24 * 60 * 60 * 1000;
export const CLOSED_BETA_CONSENT_VERSION = "2026-08-17";

export const CLOSED_BETA_MODULES = [
  "tasks",
  "projects",
  "calendar",
  "documents",
  "financial.overview",
  "financial.contracts",
  "financial.proposals",
  "financial.clients",
  "financial.receivables",
  "areas",
] as const;

export const CLOSED_BETA_STATUSES = ["active", "paused", "closed"] as const;
export type ClosedBetaStatus = (typeof CLOSED_BETA_STATUSES)[number];

export class ClosedBetaValidationError extends Error {}
export class ClosedBetaNotFoundError extends Error {}
export class ClosedBetaCapacityError extends Error {}
export class ClosedBetaInactiveError extends Error {}
export class ClosedBetaInvitationError extends Error {}
export class ClosedBetaExistingAccountError extends Error {}
export class ClosedBetaEmailMismatchError extends Error {}
export class ClosedBetaTermsError extends Error {}
export class ClosedBetaGuestCapacityError extends Error {}
export class ClosedBetaMemberError extends Error {}

type ClosedBetaDb = Prisma.TransactionClient | typeof prisma;

export interface ClosedBetaActor {
  userId: string;
  email: string;
}

export interface ClosedBetaAuditInput {
  actor?: ClosedBetaActor;
  action: string;
  targetType: string;
  targetId?: string | null;
  beforeValue?: Prisma.InputJsonValue | null;
  afterValue?: Prisma.InputJsonValue | null;
  metadata?: Prisma.InputJsonValue | null;
}

export interface ClosedBetaConfigData {
  id: string;
  status: ClosedBetaStatus;
  maxPrimaryWorkspaces: number;
  maxGuestsPerWorkspace: number;
  planId: string;
  plan: {
    id: string;
    name: string;
    isInternal: boolean;
    isActive: boolean;
    allowedModules: string[];
  };
}

export interface ClosedBetaMetrics {
  maxPrimaryWorkspaces: number;
  activePrimaryWorkspaces: number;
  reservedPrimaryWorkspaces: number;
  availablePrimaryWorkspaces: number;
}

export interface PrimaryInvitationData {
  id: string;
  email: string;
  status: string;
  expiresAt: Date;
  createdAt: Date;
  token?: string;
}

export interface PrimaryAcceptanceInput {
  token: string;
  userId: string;
  email: string;
  name?: string | null;
  emailConfirmedAt?: string | null;
  consentVersion: string;
}

export interface ClosedBetaWorkspaceData {
  enrollmentId: string;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  workspaceStatus: string;
  owner: { id: string; email: string; name: string | null };
  activeGuests: number;
  pendingGuestInvites: number;
  maxGuests: number;
  joinedAt: Date;
}

export function normalizeClosedBetaEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashClosedBetaToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createClosedBetaToken(): string {
  return randomBytes(32).toString("hex");
}

export async function recordClosedBetaAudit(
  client: ClosedBetaDb,
  input: ClosedBetaAuditInput,
) {
  return client.closedBetaAuditEvent.create({
    data: {
      actorUserId: input.actor?.userId ?? null,
      actorEmail: input.actor?.email ?? null,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      beforeValue: input.beforeValue ?? undefined,
      afterValue: input.afterValue ?? undefined,
      metadata: input.metadata ?? undefined,
    },
  });
}

async function lockClosedBetaConfig(client: Prisma.TransactionClient) {
  const rows = await client.$queryRaw<
    Array<{
      id: string;
      status: string;
      max_primary_workspaces: number;
      max_guests_per_workspace: number;
      plan_id: string;
    }>
  >(Prisma.sql`
    SELECT id, status, max_primary_workspaces, max_guests_per_workspace, plan_id
    FROM closed_beta_configs
    WHERE id = ${CLOSED_BETA_CONFIG_ID}
    FOR UPDATE
  `);

  const row = rows[0];
  if (!row) throw new ClosedBetaNotFoundError("Closed Beta configuration not found");
  return row;
}

export async function ensureClosedBetaFoundation() {
  return prisma.$transaction(async (client) => {
    const plan = await client.plan.upsert({
      where: { id: CLOSED_BETA_PLAN_ID },
      update: {
        name: CLOSED_BETA_PLAN_NAME,
        stripePriceId: null,
        allowedModules: [...CLOSED_BETA_MODULES],
        isDefault: false,
        isActive: true,
        isInternal: true,
      },
      create: {
        id: CLOSED_BETA_PLAN_ID,
        name: CLOSED_BETA_PLAN_NAME,
        stripePriceId: null,
        allowedModules: [...CLOSED_BETA_MODULES],
        isDefault: false,
        isActive: true,
        isInternal: true,
      },
    });

    const config = await client.closedBetaConfig.upsert({
      where: { id: CLOSED_BETA_CONFIG_ID },
      update: { planId: plan.id },
      create: {
        id: CLOSED_BETA_CONFIG_ID,
        status: "paused",
        maxPrimaryWorkspaces: CLOSED_BETA_DEFAULT_MAX_PRIMARY_WORKSPACES,
        maxGuestsPerWorkspace: CLOSED_BETA_DEFAULT_MAX_GUESTS_PER_WORKSPACE,
        planId: plan.id,
      },
      include: { plan: true },
    });

    return mapClosedBetaConfig(config);
  });
}

export async function getClosedBetaConfig(): Promise<ClosedBetaConfigData> {
  const config = await prisma.closedBetaConfig.findUnique({
    where: { id: CLOSED_BETA_CONFIG_ID },
    include: { plan: true },
  });
  if (!config) throw new ClosedBetaNotFoundError("Closed Beta configuration not found");
  return mapClosedBetaConfig(config);
}

export async function isPublicWorkspaceProvisioningBlocked(): Promise<boolean> {
  try {
    await getClosedBetaConfig();
    return true;
  } catch (error) {
    // Keep legacy provisioning available only while the migration is absent;
    // an unavailable database must not silently bypass Closed Beta admission.
    if (isMissingClosedBetaStorage(error)) return false;
    throw error;
  }
}

function isMissingClosedBetaStorage(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  if ("code" in error && (error as { code?: string }).code === "P2021") return true;
  return (
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string" &&
    (error as { message: string }).message.includes("closed_beta_configs") &&
    (error as { message: string }).message.includes("does not exist")
  );
}

export async function expireClosedBetaInvitations(client: ClosedBetaDb = prisma) {
  const now = new Date();
  const invitations = await client.closedBetaInvitation.findMany({
    where: { status: "pending", expiresAt: { lte: now } },
    select: { id: true, email: true, expiresAt: true },
  });
  let count = 0;
  for (const invitation of invitations) {
    const expired = await client.closedBetaInvitation.updateMany({
      where: { id: invitation.id, status: "pending" },
      data: { status: "expired", updatedAt: now },
    });
    if (expired.count === 0) continue;
    count += expired.count;
    await recordClosedBetaAudit(client, {
      action: "primary_invitation.expired",
      targetType: "closed_beta_invitation",
      targetId: invitation.id,
      beforeValue: {
        email: invitation.email,
        status: "pending",
        expiresAt: invitation.expiresAt.toISOString(),
      },
      afterValue: { status: "expired" },
    });
  }
  return { count };
}

export async function purgeClosedBetaRetention(client: ClosedBetaDb = prisma) {
  const now = Date.now();
  const invitationCutoff = new Date(now - CLOSED_BETA_INVITATION_RETENTION_MS);
  const auditCutoff = new Date(now - CLOSED_BETA_AUDIT_RETENTION_MS);
  const rateLimitCutoff = new Date(now - 24 * 60 * 60 * 1000);
  const [invitations, auditEvents, rateLimits] = await Promise.all([
    client.closedBetaInvitation.deleteMany({
      where: {
        status: { in: ["expired", "revoked", "cancelled", "accepted"] },
        updatedAt: { lt: invitationCutoff },
      },
    }),
    client.closedBetaAuditEvent.deleteMany({
      where: { createdAt: { lt: auditCutoff } },
    }),
    client.closedBetaRateLimit.deleteMany({
      where: {
        OR: [
          { updatedAt: { lt: rateLimitCutoff } },
          { blockedUntil: { lt: new Date(now) } },
        ],
      },
    }),
  ]);
  return {
    invitations: invitations.count,
    auditEvents: auditEvents.count,
    rateLimits: rateLimits.count,
  };
}

export async function consumeClosedBetaRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number,
): Promise<boolean> {
  try {
    return await prisma.$transaction(async (client) => {
      const now = new Date();
      const rows = await client.$queryRaw<
        Array<{
          key: string;
          attempt_count: number;
          window_started_at: Date;
          blocked_until: Date | null;
        }>
      >(Prisma.sql`
        SELECT key, attempt_count, window_started_at, blocked_until
        FROM closed_beta_rate_limits
        WHERE key = ${key}
        FOR UPDATE
      `);
      const current = rows[0];
      if (!current) {
        await client.closedBetaRateLimit.create({
          data: { key, attemptCount: 1, windowStartedAt: now },
        });
        return true;
      }
      if (current.blocked_until && current.blocked_until > now) return false;
      if (now.getTime() - current.window_started_at.getTime() >= windowMs) {
        await client.closedBetaRateLimit.update({
          where: { key },
          data: { attemptCount: 1, windowStartedAt: now, blockedUntil: null },
        });
        return true;
      }
      if (current.attempt_count >= maxAttempts) {
        await client.closedBetaRateLimit.update({
          where: { key },
          data: {
            blockedUntil: new Date(current.window_started_at.getTime() + windowMs),
          },
        });
        return false;
      }
      await client.closedBetaRateLimit.update({
        where: { key },
        data: { attemptCount: { increment: 1 } },
      });
      return true;
    });
  } catch {
    // Rate limiting is defense in depth; token entropy and identity checks
    // remain the authorization boundary if the limiter is unavailable.
    return true;
  }
}

export async function getClosedBetaMetrics(): Promise<ClosedBetaMetrics> {
  const config = await getClosedBetaConfig();
  await expireClosedBetaInvitations();
  await purgeClosedBetaRetention();

  const [activePrimaryWorkspaces, reservedPrimaryWorkspaces] = await Promise.all([
    prisma.closedBetaEnrollment.count({ where: { status: "active" } }),
    prisma.closedBetaInvitation.count({ where: { status: "pending" } }),
  ]);

  return {
    maxPrimaryWorkspaces: config.maxPrimaryWorkspaces,
    activePrimaryWorkspaces,
    reservedPrimaryWorkspaces,
    availablePrimaryWorkspaces: Math.max(
      0,
      config.maxPrimaryWorkspaces -
        activePrimaryWorkspaces -
        reservedPrimaryWorkspaces,
    ),
  };
}

export async function assertClosedBetaGuestSlot(
  client: Prisma.TransactionClient,
  workspaceId: string,
  excludedInviteId?: string,
) {
  if (!("closedBetaEnrollment" in client) || !("closedBetaConfig" in client)) {
    return null;
  }
  const config = await lockClosedBetaConfig(client);
  const enrollmentRows = await client.$queryRaw<
    Array<{ id: string; owner_profile_id: string }>
  >(Prisma.sql`
    SELECT id, owner_profile_id
    FROM closed_beta_enrollments
    WHERE workspace_id = ${workspaceId} AND status = 'active'
    FOR UPDATE
  `);
  const enrollment = enrollmentRows[0];
  if (!enrollment) return null;
  if (config.status !== "active") {
    throw new ClosedBetaInactiveError("Closed Beta is not accepting guest invitations");
  }

  const now = new Date();
  await client.invite.updateMany({
    where: { workspaceId, status: "pending", expiresAt: { lte: now } },
    data: { status: "expired", updatedAt: now },
  });
  const [activeGuests, pendingInvites] = await Promise.all([
    client.profile.count({
      where: {
        tenantId: workspaceId,
        removedAt: null,
        id: { not: enrollment.owner_profile_id },
      },
    }),
    client.invite.count({
      where: {
        workspaceId,
        status: "pending",
        expiresAt: { gt: now },
        ...(excludedInviteId ? { id: { not: excludedInviteId } } : {}),
      },
    }),
  ]);
  if (activeGuests + pendingInvites >= config.max_guests_per_workspace) {
    throw new ClosedBetaGuestCapacityError(
      "This workspace has no available guest slots",
    );
  }

  return {
    enrollmentId: enrollment.id,
    ownerProfileId: enrollment.owner_profile_id,
    maxGuests: config.max_guests_per_workspace,
    activeGuests,
    pendingInvites,
  };
}

export async function invalidateClosedBetaGuestInvitations(
  workspaceId: string,
  actor?: ClosedBetaActor,
  transactionClient?: Prisma.TransactionClient,
) {
  const operation = async (client: Prisma.TransactionClient | typeof prisma) => {
    const enrollment = await client.closedBetaEnrollment.findUnique({
      where: { workspaceId },
      select: { id: true },
    });
    if (!enrollment) return 0;
    const now = new Date();
    const cancelled = await client.invite.updateMany({
      where: { workspaceId, status: "pending" },
      data: { status: "cancelled", updatedAt: now },
    });
    if (cancelled.count > 0) {
      await recordClosedBetaAudit(client, {
        actor,
        action: "guest_invitations.cancelled_on_binding_rotation",
        targetType: "closed_beta_enrollment",
        targetId: enrollment.id,
        metadata: { workspaceId, count: cancelled.count },
      });
    }
    return cancelled.count;
  };

  if (transactionClient) return operation(transactionClient);
  return prisma.$transaction(operation);
}

export async function removeClosedBetaMember(
  workspaceId: string,
  profileId: string,
  actor: ClosedBetaActor,
) {
  return prisma.$transaction(async (client) => {
    const enrollment = await client.closedBetaEnrollment.findUnique({
      where: { workspaceId },
      select: { id: true, ownerProfileId: true, status: true },
    });
    if (!enrollment || enrollment.status !== "active") {
      throw new ClosedBetaMemberError("This workspace is not enrolled in Closed Beta");
    }
    if (enrollment.ownerProfileId === profileId) {
      throw new ClosedBetaMemberError("The workspace owner cannot be removed");
    }
    const profile = await client.profile.findFirst({
      where: { id: profileId, tenantId: workspaceId, removedAt: null },
      select: { id: true, email: true },
    });
    if (!profile) throw new ClosedBetaMemberError("Member not found");

    const removed = await client.profile.update({
      where: { id: profile.id },
      data: { removedAt: new Date(), roleId: null },
      select: { id: true, email: true, removedAt: true },
    });
    await recordClosedBetaAudit(client, {
      actor,
      action: "guest.removed",
      targetType: "profile",
      targetId: profile.id,
      beforeValue: { email: profile.email, active: true },
      afterValue: { email: profile.email, active: false },
    });
    return removed;
  });
}

export async function getClosedBetaGuestUsage(workspaceId: string) {
  const enrollment = await prisma.closedBetaEnrollment.findUnique({
    where: { workspaceId },
    select: { ownerProfileId: true, status: true },
  });
  if (!enrollment || enrollment.status !== "active") return null;
  const config = await getClosedBetaConfig();
  await prisma.invite.updateMany({
    where: { workspaceId, status: "pending", expiresAt: { lte: new Date() } },
    data: { status: "expired" },
  });
  const [activeGuests, pendingGuestInvites] = await Promise.all([
    prisma.profile.count({
      where: { tenantId: workspaceId, removedAt: null, id: { not: enrollment.ownerProfileId } },
    }),
    prisma.invite.count({ where: { workspaceId, status: "pending" } }),
  ]);
  return {
    activeGuests,
    pendingGuestInvites,
    maxGuests: config.maxGuestsPerWorkspace,
  };
}

export async function listClosedBetaWorkspaces(): Promise<ClosedBetaWorkspaceData[]> {
  const enrollments = await prisma.closedBetaEnrollment.findMany({
    where: { status: "active" },
    include: {
      workspace: {
        select: { id: true, name: true, slug: true, status: true, deletedAt: true },
      },
      owner: { select: { id: true, email: true, name: true, removedAt: true } },
    },
    orderBy: { joinedAt: "asc" },
  });
  const rows = await Promise.all(
    enrollments
      .filter((enrollment) => !enrollment.workspace.deletedAt && !enrollment.owner.removedAt)
      .map(async (enrollment) => {
        const usage = await getClosedBetaGuestUsage(enrollment.workspaceId);
        return {
          enrollmentId: enrollment.id,
          workspaceId: enrollment.workspaceId,
          workspaceName: enrollment.workspace.name,
          workspaceSlug: enrollment.workspace.slug,
          workspaceStatus: enrollment.workspace.status,
          owner: {
            id: enrollment.owner.id,
            email: enrollment.owner.email,
            name: enrollment.owner.name,
          },
          activeGuests: usage?.activeGuests ?? 0,
          pendingGuestInvites: usage?.pendingGuestInvites ?? 0,
          maxGuests: usage?.maxGuests ?? 0,
          joinedAt: enrollment.joinedAt,
        } satisfies ClosedBetaWorkspaceData;
      }),
  );
  return rows;
}

export async function listClosedBetaAuditEvents(limit = 100) {
  return prisma.closedBetaAuditEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 250),
  });
}

export async function listClosedBetaWorkspaceCandidates() {
  return prisma.workspace.findMany({
    where: {
      deletedAt: null,
      OR: [
        { closedBetaEnrollment: null },
        { closedBetaEnrollment: { is: { status: "left" } } },
      ],
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      profiles: {
        where: { removedAt: null },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, email: true },
      },
    },
  });
}

export async function enrollExistingWorkspace(
  workspaceId: string,
  ownerProfileId: string,
  actor: ClosedBetaActor,
) {
  return prisma.$transaction(async (client) => {
    const config = await lockClosedBetaConfig(client);
    if (config.status !== "active") {
      throw new ClosedBetaInactiveError("Closed Beta is not accepting companies");
    }
    const workspace = await client.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, name: true, planId: true, deletedAt: true },
    });
    if (!workspace || workspace.deletedAt) {
      throw new ClosedBetaNotFoundError("Workspace not found");
    }
    const owner = await client.profile.findFirst({
      where: { id: ownerProfileId, tenantId: workspaceId, removedAt: null },
      select: { id: true, email: true },
    });
    if (!owner) throw new ClosedBetaValidationError("Owner profile not found in workspace");
    const existing = await client.closedBetaEnrollment.findUnique({
      where: { workspaceId },
      select: { id: true, status: true },
    });
    if (existing?.status === "active") {
      throw new ClosedBetaValidationError("Workspace is already in Closed Beta");
    }
    const activePrimaryWorkspaces = await client.closedBetaEnrollment.count({
      where: { status: "active" },
    });
    if (activePrimaryWorkspaces >= config.max_primary_workspaces) {
      throw new ClosedBetaCapacityError("Closed Beta has no available primary slots");
    }

    await client.workspace.update({
      where: { id: workspaceId },
      data: { planId: config.plan_id },
    });
    const enrollment = existing
      ? await client.closedBetaEnrollment.update({
          where: { id: existing.id },
          data: {
            ownerProfileId,
            status: "active",
            source: "manual",
            previousPlanId: workspace.planId,
            joinedAt: new Date(),
            leftAt: null,
          },
        })
      : await client.closedBetaEnrollment.create({
          data: {
            workspaceId,
            ownerProfileId,
            status: "active",
            source: "manual",
            previousPlanId: workspace.planId,
          },
        });
    await recordClosedBetaAudit(client, {
      actor,
      action: "workspace.enrolled",
      targetType: "closed_beta_enrollment",
      targetId: enrollment.id,
      beforeValue: { planId: workspace.planId },
      afterValue: { workspaceId, ownerProfileId, planId: config.plan_id, source: "manual" },
    });
    return enrollment;
  });
}

export async function removeClosedBetaEnrollment(
  workspaceId: string,
  actor: ClosedBetaActor,
) {
  return prisma.$transaction(async (client) => {
    await lockClosedBetaConfig(client);
    const enrollment = await client.closedBetaEnrollment.findUnique({
      where: { workspaceId },
    });
    if (!enrollment || enrollment.status !== "active") {
      throw new ClosedBetaNotFoundError("Closed Beta enrollment not found");
    }
    const workspace = await client.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, planId: true },
    });
    const left = await client.closedBetaEnrollment.update({
      where: { id: enrollment.id },
      data: { status: "left", leftAt: new Date() },
    });
    await client.workspace.update({
      where: { id: workspaceId },
      data: { planId: enrollment.previousPlanId ?? null },
    });
    await client.invite.updateMany({
      where: { workspaceId, status: "pending" },
      data: { status: "cancelled", updatedAt: new Date() },
    });
    await recordClosedBetaAudit(client, {
      actor,
      action: "workspace.removed",
      targetType: "closed_beta_enrollment",
      targetId: enrollment.id,
      beforeValue: { planId: workspace?.planId ?? null, status: enrollment.status },
      afterValue: { planId: enrollment.previousPlanId ?? null, status: left.status },
    });
    return left;
  });
}

export async function setWorkspacePlanAndLeaveClosedBeta(
  workspaceId: string,
  planId: string,
  actor?: ClosedBetaActor,
) {
  return prisma.$transaction(async (client) => {
    const enrollment = await client.closedBetaEnrollment.findUnique({
      where: { workspaceId },
      select: { id: true, status: true },
    });
    await client.workspace.update({ where: { id: workspaceId }, data: { planId } });
    if (!enrollment || enrollment.status !== "active") return;

    const left = await client.closedBetaEnrollment.update({
      where: { id: enrollment.id },
      data: { status: "left", leftAt: new Date() },
    });
    await client.invite.updateMany({
      where: { workspaceId, status: "pending" },
      data: { status: "cancelled", updatedAt: new Date() },
    });
    await recordClosedBetaAudit(client, {
      actor: actor ?? { userId: "system", email: "system" },
      action: "workspace.upgraded_from_beta",
      targetType: "closed_beta_enrollment",
      targetId: enrollment.id,
      afterValue: { workspaceId, planId, status: left.status },
    });
  });
}

export async function createPrimaryInvitation(
  rawEmail: string,
  actor: ClosedBetaActor,
): Promise<PrimaryInvitationData> {
  const email = normalizeClosedBetaEmail(rawEmail);
  if (!isValidEmail(email)) {
    throw new ClosedBetaValidationError("A valid email is required");
  }

  return prisma.$transaction(async (client) => {
    const config = await lockClosedBetaConfig(client);
    if (config.status !== "active") {
      throw new ClosedBetaInactiveError("Closed Beta is not accepting invitations");
    }

    await expireClosedBetaInvitations(client);
    const existingProfile = await client.profile.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    });
    if (existingProfile) {
      throw new ClosedBetaExistingAccountError("This email already has an account");
    }

    const existingInvitation = await client.closedBetaInvitation.findFirst({
      where: { email, status: "pending" },
      select: { id: true },
    });
    if (existingInvitation) {
      throw new ClosedBetaInvitationError("This email already has a pending invitation");
    }

    const [activePrimaryWorkspaces, reservedPrimaryWorkspaces] = await Promise.all([
      client.closedBetaEnrollment.count({ where: { status: "active" } }),
      client.closedBetaInvitation.count({ where: { status: "pending" } }),
    ]);
    if (
      activePrimaryWorkspaces + reservedPrimaryWorkspaces >=
      config.max_primary_workspaces
    ) {
      throw new ClosedBetaCapacityError("Closed Beta has no available primary slots");
    }

    const token = createClosedBetaToken();
    const invitation = await client.closedBetaInvitation.create({
      data: {
        email,
        tokenHash: hashClosedBetaToken(token),
        status: "pending",
        expiresAt: new Date(Date.now() + CLOSED_BETA_INVITATION_TTL_MS),
        createdByUserId: actor.userId,
        createdByEmail: actor.email,
      },
    });

    await recordClosedBetaAudit(client, {
      actor,
      action: "primary_invitation.created",
      targetType: "closed_beta_invitation",
      targetId: invitation.id,
      afterValue: { email, status: invitation.status, expiresAt: invitation.expiresAt.toISOString() },
    });

    return mapPrimaryInvitation(invitation, token);
  });
}

export async function getPrimaryInvitationByToken(token: string) {
  if (!token || token.length < 32) return null;
  await expireClosedBetaInvitations();
  const invitation = await prisma.closedBetaInvitation.findUnique({
    where: { tokenHash: hashClosedBetaToken(token) },
    select: { id: true, status: true, expiresAt: true },
  });
  if (!invitation) return null;
  return {
    id: invitation.id,
    status: invitation.status,
    expiresAt: invitation.expiresAt,
  };
}

export async function listPrimaryInvitations(): Promise<PrimaryInvitationData[]> {
  await expireClosedBetaInvitations();
  const invitations = await prisma.closedBetaInvitation.findMany({
    orderBy: { createdAt: "desc" },
  });
  return invitations.map((invitation) => mapPrimaryInvitation(invitation));
}

export async function revokePrimaryInvitation(
  invitationId: string,
  actor: ClosedBetaActor,
) {
  return prisma.$transaction(async (client) => {
    await lockClosedBetaConfig(client);
    await expireClosedBetaInvitations(client);
    const invitation = await client.closedBetaInvitation.findUnique({
      where: { id: invitationId },
    });
    if (!invitation) throw new ClosedBetaNotFoundError("Invitation not found");
    if (invitation.status !== "pending") {
      throw new ClosedBetaInvitationError("This invitation can no longer be revoked");
    }

    const revoked = await client.closedBetaInvitation.update({
      where: { id: invitation.id },
      data: { status: "revoked", revokedAt: new Date() },
    });
    await recordClosedBetaAudit(client, {
      actor,
      action: "primary_invitation.revoked",
      targetType: "closed_beta_invitation",
      targetId: invitation.id,
      beforeValue: { email: invitation.email, status: invitation.status },
      afterValue: { status: revoked.status },
    });
    return mapPrimaryInvitation(revoked);
  });
}

export async function reissuePrimaryInvitation(
  invitationId: string,
  actor: ClosedBetaActor,
): Promise<PrimaryInvitationData> {
  return prisma.$transaction(async (client) => {
    const config = await lockClosedBetaConfig(client);
    if (config.status !== "active") {
      throw new ClosedBetaInactiveError("Closed Beta is not accepting invitations");
    }

    await expireClosedBetaInvitations(client);
    const invitation = await client.closedBetaInvitation.findUnique({
      where: { id: invitationId },
    });
    if (!invitation) throw new ClosedBetaNotFoundError("Invitation not found");
    if (invitation.status === "accepted") {
      throw new ClosedBetaInvitationError("An accepted invitation cannot be reissued");
    }

    const reusesReservation = invitation.status === "pending";
    if (!reusesReservation) {
      const [activePrimaryWorkspaces, reservedPrimaryWorkspaces] = await Promise.all([
        client.closedBetaEnrollment.count({ where: { status: "active" } }),
        client.closedBetaInvitation.count({ where: { status: "pending" } }),
      ]);
      if (
        activePrimaryWorkspaces + reservedPrimaryWorkspaces >=
        config.max_primary_workspaces
      ) {
        throw new ClosedBetaCapacityError("Closed Beta has no available primary slots");
      }
    }

    const now = new Date();
    await client.closedBetaInvitation.update({
      where: { id: invitation.id },
      data: { status: "revoked", revokedAt: now, updatedAt: now },
    });
    const token = createClosedBetaToken();
    const replacement = await client.closedBetaInvitation.create({
      data: {
        email: invitation.email,
        tokenHash: hashClosedBetaToken(token),
        status: "pending",
        expiresAt: new Date(Date.now() + CLOSED_BETA_INVITATION_TTL_MS),
        createdByUserId: actor.userId,
        createdByEmail: actor.email,
      },
    });

    await recordClosedBetaAudit(client, {
      actor,
      action: "primary_invitation.reissued",
      targetType: "closed_beta_invitation",
      targetId: replacement.id,
      metadata: { previousInvitationId: invitation.id, reusedReservation: reusesReservation },
      afterValue: { email: replacement.email, expiresAt: replacement.expiresAt.toISOString() },
    });
    return mapPrimaryInvitation(replacement, token);
  });
}

export async function acceptPrimaryInvitation(input: PrimaryAcceptanceInput) {
  const email = normalizeClosedBetaEmail(input.email);
  if (!input.emailConfirmedAt) {
    throw new ClosedBetaEmailMismatchError("A verified email is required");
  }
  if (input.consentVersion !== CLOSED_BETA_CONSENT_VERSION) {
    throw new ClosedBetaTermsError("The current Closed Beta terms must be accepted");
  }
  if (!email || !input.token) {
    throw new ClosedBetaInvitationError("The invitation could not be verified");
  }

  return prisma.$transaction(async (client) => {
    const config = await lockClosedBetaConfig(client);
    if (config.status !== "active") {
      throw new ClosedBetaInactiveError("Closed Beta is not accepting invitations");
    }

    await expireClosedBetaInvitations(client);
    const invitation = await client.closedBetaInvitation.findUnique({
      where: { tokenHash: hashClosedBetaToken(input.token) },
    });
    if (!invitation || invitation.status !== "pending") {
      throw new ClosedBetaInvitationError("The invitation could not be verified");
    }
    if (invitation.expiresAt.getTime() <= Date.now()) {
      throw new ClosedBetaInvitationError("The invitation has expired");
    }
    if (normalizeClosedBetaEmail(invitation.email) !== email) {
      throw new ClosedBetaEmailMismatchError("The invitation email does not match");
    }

    const existingProfile = await client.profile.findFirst({
      where: {
        OR: [
          { id: input.userId },
          { email: { equals: email, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });
    if (existingProfile) {
      throw new ClosedBetaExistingAccountError("This account is already associated with a workspace");
    }

    const activePrimaryWorkspaces = await client.closedBetaEnrollment.count({
      where: { status: "active" },
    });
    if (activePrimaryWorkspaces >= config.max_primary_workspaces) {
      throw new ClosedBetaCapacityError("Closed Beta has no available primary slots");
    }

    const workspaceSetup = await createWorkspaceForUserWithPlan(
      input.name?.trim() || email.split("@")[0] || "My Workspace",
      email,
      config.plan_id,
      client,
    );
    const profile = await client.profile.create({
      data: {
        id: input.userId,
        email,
        name: input.name?.trim() || null,
        tenantId: workspaceSetup.id,
        roleId: workspaceSetup.adminRoleId,
      },
    });
    const enrollment = await client.closedBetaEnrollment.create({
      data: {
        workspaceId: workspaceSetup.id,
        ownerProfileId: profile.id,
        status: "active",
        source: "invitation",
        consentVersion: input.consentVersion,
        consentedAt: new Date(),
      },
    });
    const acceptedInvitation = await client.closedBetaInvitation.update({
      where: { id: invitation.id },
      data: {
        status: "accepted",
        acceptedAt: new Date(),
        workspaceId: workspaceSetup.id,
      },
    });

    await recordClosedBetaAudit(client, {
      actor: { userId: input.userId, email },
      action: "primary_invitation.accepted",
      targetType: "closed_beta_enrollment",
      targetId: enrollment.id,
      afterValue: {
        workspaceId: workspaceSetup.id,
        ownerProfileId: profile.id,
        invitationId: acceptedInvitation.id,
        consentVersion: input.consentVersion,
      },
    });

    return { profile, workspaceId: workspaceSetup.id, enrollment };
  });
}

export async function updateClosedBetaConfig(
  input: {
    status?: ClosedBetaStatus;
    maxPrimaryWorkspaces?: number;
    maxGuestsPerWorkspace?: number;
  },
  actor: ClosedBetaActor,
) {
  validateConfigInput(input);

  return prisma.$transaction(async (client) => {
    const current = await lockClosedBetaConfig(client);
    const nextStatus = input.status ?? current.status;
    const nextMaxPrimary =
      input.maxPrimaryWorkspaces ?? current.max_primary_workspaces;
    const nextMaxGuests =
      input.maxGuestsPerWorkspace ?? current.max_guests_per_workspace;
    const now = new Date();

    await client.closedBetaConfig.update({
      where: { id: CLOSED_BETA_CONFIG_ID },
      data: {
        status: nextStatus,
        maxPrimaryWorkspaces: nextMaxPrimary,
        maxGuestsPerWorkspace: nextMaxGuests,
      },
    });

    await recordClosedBetaAudit(client, {
      actor,
      action: "config.updated",
      targetType: "closed_beta_config",
      targetId: CLOSED_BETA_CONFIG_ID,
      beforeValue: {
        status: current.status,
        maxPrimaryWorkspaces: current.max_primary_workspaces,
        maxGuestsPerWorkspace: current.max_guests_per_workspace,
      },
      afterValue: {
        status: nextStatus,
        maxPrimaryWorkspaces: nextMaxPrimary,
        maxGuestsPerWorkspace: nextMaxGuests,
      },
    });

    if (nextStatus === "closed" && current.status !== "closed") {
      const revoked = await client.closedBetaInvitation.updateMany({
        where: { status: "pending" },
        data: { status: "revoked", revokedAt: now, updatedAt: now },
      });
      if (revoked.count > 0) {
        await recordClosedBetaAudit(client, {
          actor,
          action: "primary_invitations.revoked_on_close",
          targetType: "closed_beta_config",
          targetId: CLOSED_BETA_CONFIG_ID,
          metadata: { count: revoked.count },
        });
      }
    }

    const updated = await client.closedBetaConfig.findUnique({
      where: { id: CLOSED_BETA_CONFIG_ID },
      include: { plan: true },
    });
    if (!updated) throw new ClosedBetaNotFoundError("Closed Beta configuration not found");
    return mapClosedBetaConfig(updated);
  });
}

function mapClosedBetaConfig(config: {
  id: string;
  status: string;
  maxPrimaryWorkspaces: number;
  maxGuestsPerWorkspace: number;
  planId: string;
  plan: {
    id: string;
    name: string;
    isInternal: boolean;
    isActive: boolean;
    allowedModules: unknown;
  };
}): ClosedBetaConfigData {
  if (!CLOSED_BETA_STATUSES.includes(config.status as ClosedBetaStatus)) {
    throw new ClosedBetaValidationError("Invalid Closed Beta status");
  }

  return {
    id: config.id,
    status: config.status as ClosedBetaStatus,
    maxPrimaryWorkspaces: config.maxPrimaryWorkspaces,
    maxGuestsPerWorkspace: config.maxGuestsPerWorkspace,
    planId: config.planId,
    plan: {
      id: config.plan.id,
      name: config.plan.name,
      isInternal: config.plan.isInternal,
      isActive: config.plan.isActive,
      allowedModules: Array.isArray(config.plan.allowedModules)
        ? config.plan.allowedModules.filter(
            (module): module is string => typeof module === "string",
          )
        : [],
    },
  };
}

function mapPrimaryInvitation(
  invitation: {
    id: string;
    email: string;
    status: string;
    expiresAt: Date;
    createdAt: Date;
  },
  token?: string,
): PrimaryInvitationData {
  return {
    id: invitation.id,
    email: invitation.email,
    status: invitation.status,
    expiresAt: invitation.expiresAt,
    createdAt: invitation.createdAt,
    ...(token ? { token } : {}),
  };
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateConfigInput(input: {
  status?: ClosedBetaStatus;
  maxPrimaryWorkspaces?: number;
  maxGuestsPerWorkspace?: number;
}) {
  if (input.status !== undefined && !CLOSED_BETA_STATUSES.includes(input.status)) {
    throw new ClosedBetaValidationError("Invalid Closed Beta status");
  }
  for (const value of [input.maxPrimaryWorkspaces, input.maxGuestsPerWorkspace]) {
    if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
      throw new ClosedBetaValidationError("Closed Beta limits must be non-negative integers");
    }
  }
}
