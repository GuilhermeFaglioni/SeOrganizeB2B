import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  prismaClient: {
    closedBetaConfig: { findUnique: vi.fn(), update: vi.fn() },
    closedBetaEnrollment: { count: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    closedBetaInvitation: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 0 }), count: vi.fn() },
    closedBetaAuditEvent: { create: vi.fn() },
    profile: { findFirst: vi.fn(), update: vi.fn() },
    workspace: { findUnique: vi.fn() },
    invite: { updateMany: vi.fn(), count: vi.fn() },
    $transaction: vi.fn(async (fn: unknown) => fn(mocks.prismaClient)),
    $queryRaw: vi.fn(),
  },
}));

vi.mock("../../prisma/client", () => ({
  prisma: mocks.prismaClient,
}));

vi.mock("node:crypto", () => ({
  createHash: () => ({ update: () => ({ digest: () => "hash" }) }),
  randomBytes: () => ({ toString: () => "token123" }),
}));

import {
  createPrimaryInvitation,
  acceptPrimaryInvitation,
  ClosedBetaCapacityError,
  ClosedBetaInactiveError,
  CLOSED_BETA_CONSENT_VERSION,
  invalidateClosedBetaGuestInvitations,
  removeClosedBetaMember,
  ClosedBetaGuestCapacityError,
  ClosedBetaMemberError,
  updateClosedBetaConfig,
} from "../lib/closed-beta/service";

const config30 = {
  id: "default",
  status: "active",
  max_primary_workspaces: 30,
  max_guests_per_workspace: 3,
  plan_id: "plan-1",
  plan: {
    id: "plan-1",
    name: "Closed Beta",
    isInternal: true,
    isActive: true,
    allowedModules: ["tasks"],
  },
};

const enrollment = { id: "en-1", owner_profile_id: "owner-1" };
const actor = { userId: "admin-1", email: "admin@co" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prismaClient.closedBetaConfig.findUnique.mockResolvedValue(config30);
  mocks.prismaClient.$queryRaw.mockResolvedValue([{
    id: "default",
    status: "active",
    max_primary_workspaces: 30,
    max_guests_per_workspace: 3,
    plan_id: "plan-1",
  }]);
  mocks.prismaClient.closedBetaEnrollment.count.mockResolvedValue(0);
  mocks.prismaClient.closedBetaInvitation.count.mockResolvedValue(0);
  mocks.prismaClient.closedBetaInvitation.findMany.mockResolvedValue([]);
  mocks.prismaClient.profile.findFirst.mockResolvedValue(null);
  mocks.prismaClient.closedBetaInvitation.findFirst.mockResolvedValue(null);
  mocks.prismaClient.closedBetaInvitation.findUnique.mockResolvedValue(null);
});

describe("primary capacity exact boundary", () => {
  it("rejects invitation when all 30 slots are consumed", async () => {
    mocks.prismaClient.closedBetaEnrollment.count.mockResolvedValue(30);
    mocks.prismaClient.closedBetaInvitation.count.mockResolvedValue(0);
    mocks.prismaClient.closedBetaInvitation.findMany.mockResolvedValue([]);
    mocks.prismaClient.profile.findFirst.mockResolvedValue(null);
    mocks.prismaClient.closedBetaInvitation.findFirst.mockResolvedValue(null);

    await expect(
      createPrimaryInvitation("new@company.com", actor),
    ).rejects.toBeInstanceOf(ClosedBetaCapacityError);
  });

  it("allows invitation when 29 active + 0 pending = 29 < 30", async () => {
    mocks.prismaClient.closedBetaEnrollment.count.mockResolvedValue(29);
    mocks.prismaClient.closedBetaInvitation.count.mockResolvedValue(0);
    mocks.prismaClient.closedBetaInvitation.findMany.mockResolvedValue([]);
    mocks.prismaClient.profile.findFirst.mockResolvedValue(null);
    mocks.prismaClient.closedBetaInvitation.findFirst.mockResolvedValue(null);
    mocks.prismaClient.closedBetaInvitation.create.mockResolvedValue({
      id: "inv-1", email: "new@company.com", status: "pending",
      expiresAt: new Date("2026-12-31"), createdAt: new Date(),
    });

    const result = await createPrimaryInvitation("new@company.com", actor);
    expect(result.email).toBe("new@company.com");
    expect(mocks.prismaClient.closedBetaInvitation.create).toHaveBeenCalled();
  });

  it("blocks acceptance when 30th workspace would exceed capacity", async () => {
    mocks.prismaClient.closedBetaEnrollment.count.mockResolvedValue(30);
    mocks.prismaClient.closedBetaInvitation.findUnique.mockResolvedValue({
      id: "inv-1", status: "pending", expiresAt: new Date("2099-01-01"), email: "u@co",
    });
    mocks.prismaClient.profile.findFirst.mockResolvedValue(null);

    await expect(
      acceptPrimaryInvitation({
        token: "token123",
        userId: "u-1",
        email: "u@co",
        emailConfirmedAt: "2026-01-01T00:00:00Z",
        consentVersion: CLOSED_BETA_CONSENT_VERSION,
      }),
    ).rejects.toBeInstanceOf(ClosedBetaCapacityError);
  });
});

describe("paused/closed states", () => {
  it("paused config blocks new invitations", async () => {
    mocks.prismaClient.$queryRaw.mockResolvedValue([{ ...config30, status: "paused" }]);
    mocks.prismaClient.closedBetaConfig.findUnique.mockResolvedValue({ ...config30, status: "paused" });

    await expect(
      createPrimaryInvitation("new@company.com", actor),
    ).rejects.toBeInstanceOf(ClosedBetaInactiveError);
  });

  it("closed config revokes all pending invitations", async () => {
    // Override the beforeEach mock to return closed status after update
    mocks.prismaClient.closedBetaConfig.findUnique.mockResolvedValue({
      ...config30,
      status: "closed",
    });

    const result = await updateClosedBetaConfig(
      { status: "closed" },
      actor,
    );
    expect(result.status).toBe("closed");
    expect(mocks.prismaClient.closedBetaInvitation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "pending" },
        data: expect.objectContaining({ status: "revoked" }),
      }),
    );
  });
});

describe("guest capacity and member removal", () => {
  it("removeClosedBetaMember releases a slot", async () => {
    mocks.prismaClient.closedBetaEnrollment.findUnique.mockResolvedValue({
      id: "en-1", ownerProfileId: "owner-1", status: "active",
    });
    mocks.prismaClient.profile.findFirst.mockResolvedValue({ id: "guest-1", email: "g@co" });
    mocks.prismaClient.profile.update.mockResolvedValue({ id: "guest-1", email: "g@co", removedAt: new Date(), roleId: null });

    await removeClosedBetaMember("ws-1", "guest-1", actor);
    expect(mocks.prismaClient.profile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "guest-1" },
        data: expect.objectContaining({ removedAt: expect.any(Date), roleId: null }),
      }),
    );
  });

  it("cannot remove the workspace owner", async () => {
    mocks.prismaClient.closedBetaEnrollment.findUnique.mockResolvedValue({
      id: "en-1", ownerProfileId: "owner-1", status: "active",
    });
    mocks.prismaClient.profile.findFirst.mockResolvedValue({ id: "owner-1", email: "o@co" });

    await expect(
      removeClosedBetaMember("ws-1", "owner-1", actor),
    ).rejects.toBeInstanceOf(ClosedBetaMemberError);
  });
});

describe("binding-code rotation cancels pending guest invites", () => {
  it("invalidateClosedBetaGuestInvitations cancels all pending invites", async () => {
    mocks.prismaClient.closedBetaEnrollment.findUnique.mockResolvedValue({ id: "en-1" });
    mocks.prismaClient.invite.updateMany.mockResolvedValue({ count: 2 });

    const count = await invalidateClosedBetaGuestInvitations("ws-1", actor);
    expect(count).toBe(2);
    expect(mocks.prismaClient.invite.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId: "ws-1", status: "pending" },
        data: expect.objectContaining({ status: "cancelled" }),
      }),
    );
  });
});
