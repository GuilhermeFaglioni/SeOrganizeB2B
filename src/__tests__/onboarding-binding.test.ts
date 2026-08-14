import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  bindUserToWorkspace,
  BindingCodeAmbiguousError,
  BindingCodeInvalidError,
  BindingCodeRateLimitError,
  getOnboardingStatus,
  InviteNotFoundError,
  OnboardingRequiredError,
} from "../lib/invites/service";
import { hashBindingCode } from "../lib/invites/binding-code";

const mocks = vi.hoisted(() => ({
  profileFindUnique: vi.fn(),
  profileCreate: vi.fn(),
  inviteUpdateMany: vi.fn(),
  inviteFindMany: vi.fn(),
  inviteFindUnique: vi.fn(),
  inviteUpdate: vi.fn(),
  attemptFindUnique: vi.fn(),
  attemptDeleteMany: vi.fn(),
  attemptUpsert: vi.fn(),
  attemptUpdateMany: vi.fn(),
  attemptUpdate: vi.fn(),
  attemptDelete: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../prisma/client", () => ({
  prisma: {
    profile: {
      findUnique: mocks.profileFindUnique,
      create: mocks.profileCreate,
    },
    invite: {
      updateMany: mocks.inviteUpdateMany,
      findMany: mocks.inviteFindMany,
      findUnique: mocks.inviteFindUnique,
      update: mocks.inviteUpdate,
    },
    workspaceBindingAttempt: {
      findUnique: mocks.attemptFindUnique,
      deleteMany: mocks.attemptDeleteMany,
      upsert: mocks.attemptUpsert,
      updateMany: mocks.attemptUpdateMany,
      update: mocks.attemptUpdate,
      delete: mocks.attemptDelete,
    },
    $transaction: mocks.transaction,
  },
  withTenant: (_tenantId: string, fn: () => unknown) => fn(),
}));

const future = new Date(Date.now() + 60_000);

describe("workspace onboarding binding", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.profileFindUnique.mockResolvedValue(null);
    mocks.inviteUpdateMany.mockResolvedValue({ count: 0 });
    mocks.inviteFindMany.mockResolvedValue([]);
    mocks.attemptFindUnique.mockResolvedValue(null);
    mocks.attemptDeleteMany.mockResolvedValue({ count: 0 });
    mocks.attemptDelete.mockResolvedValue({});
    mocks.attemptUpsert.mockResolvedValue({});
    mocks.attemptUpdateMany.mockResolvedValue({ count: 1 });
    mocks.attemptUpdate.mockResolvedValue({});
  });

  it("reports a new workspace when there is no profile or invitation", async () => {
    await expect(
      getOnboardingStatus({ userId: "user-1", email: "user@example.com" }),
    ).resolves.toEqual({ status: "workspace_creation_required" });
  });

  it("requires a code for a configured pending invitation", async () => {
    mocks.inviteFindMany.mockResolvedValue([
      { status: "pending", workspace: { bindingCodeHash: "hash" } },
    ]);

    await expect(
      getOnboardingStatus({ userId: "user-1", email: "USER@example.com" }),
    ).resolves.toEqual({ status: "binding_required", reason: "pending_invite" });
  });

  it("blocks when a pending invitation has no workspace code", async () => {
    mocks.inviteFindMany.mockResolvedValue([
      { status: "pending", workspace: { bindingCodeHash: null } },
    ]);

    await expect(
      getOnboardingStatus({ userId: "user-1", email: "user@example.com" }),
    ).resolves.toEqual({ status: "binding_setup_required" });
  });

  it("keeps an expired invitation from silently creating a workspace", async () => {
    mocks.inviteFindMany.mockResolvedValue([
      { status: "expired", workspace: { bindingCodeHash: "hash" } },
    ]);

    await expect(
      getOnboardingStatus({ userId: "user-1", email: "user@example.com" }),
    ).resolves.toEqual({ status: "binding_required", reason: "expired_invite" });
  });

  it("does not spend binding attempts on an expired invitation", async () => {
    mocks.inviteFindMany.mockResolvedValue([
      { status: "expired", workspace: { bindingCodeHash: "hash" } },
    ]);

    await expect(
      bindUserToWorkspace({
        userId: "user-1",
        email: "user@example.com",
        bindingCode: "Acme-Join-2026",
      }),
    ).rejects.toMatchObject({ state: { reason: "expired_invite" } });
    expect(mocks.attemptUpsert).not.toHaveBeenCalled();
  });

  it("creates the profile, accepts one invite, and supersedes the others", async () => {
    const code = "Acme-Join-2026";
    const codeHash = await hashBindingCode(code);
    const selectedInvite = {
      id: "invite-a",
      email: "user@example.com",
      workspaceId: "workspace-a",
      roleId: null,
      expiresAt: future,
      workspace: { bindingCodeHash: codeHash, defaultRoleId: "member-a" },
    };
    mocks.inviteFindMany
      .mockResolvedValueOnce([
        { status: "pending", workspace: { bindingCodeHash: codeHash } },
      ])
      .mockResolvedValueOnce([selectedInvite]);
    mocks.profileFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    mocks.inviteFindUnique.mockResolvedValue({
      id: "invite-a",
      email: "user@example.com",
      workspaceId: "workspace-a",
      roleId: null,
      status: "pending",
      expiresAt: future,
      workspace: { bindingCodeHash: codeHash, defaultRoleId: "member-a" },
    });

    const transactionProfileCreate = vi.fn().mockResolvedValue({
      id: "user-1",
      tenantId: "workspace-a",
      roleId: "member-a",
    });
    const transactionInviteUpdate = vi.fn().mockResolvedValue({
      id: "invite-a",
      status: "accepted",
    });
    const transactionInviteUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        profile: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: transactionProfileCreate,
        },
        invite: {
          findUnique: mocks.inviteFindUnique,
          update: transactionInviteUpdate,
          updateMany: transactionInviteUpdateMany,
        },
      }),
    );

    const result = await bindUserToWorkspace({
      userId: "user-1",
      email: "USER@example.com",
      bindingCode: code,
      name: "User",
    });

    expect(result.profile).toEqual({
      id: "user-1",
      tenantId: "workspace-a",
      roleId: "member-a",
    });
    expect(transactionProfileCreate).toHaveBeenCalledWith({
      data: {
        id: "user-1",
        email: "user@example.com",
        name: "User",
        tenantId: "workspace-a",
        roleId: "member-a",
      },
    });
    expect(transactionInviteUpdateMany).toHaveBeenCalledWith({
      where: {
        email: "user@example.com",
        status: "pending",
        id: { not: "invite-a" },
      },
      data: { status: "superseded" },
    });
    expect(transactionInviteUpdate).toHaveBeenCalledWith({
      where: { id: "invite-a", status: "pending" },
      data: expect.objectContaining({ status: "accepted" }),
    });
    expect(mocks.attemptDelete).toHaveBeenCalledWith({ where: { userId: "user-1" } });
  });

  it("does not create a profile for an invalid code", async () => {
    const codeHash = await hashBindingCode("Acme-Join-2026");
    const invite = {
      id: "invite-a",
      email: "user@example.com",
      workspaceId: "workspace-a",
      roleId: "member-a",
      expiresAt: future,
      workspace: { bindingCodeHash: codeHash, defaultRoleId: "member-a" },
    };
    mocks.inviteFindMany
      .mockResolvedValueOnce([{ status: "pending", workspace: { bindingCodeHash: codeHash } }])
      .mockResolvedValueOnce([invite]);

    await expect(
      bindUserToWorkspace({
        userId: "user-1",
        email: "user@example.com",
        bindingCode: "Wrong-Code",
      }),
    ).rejects.toBeInstanceOf(BindingCodeInvalidError);
    expect(mocks.profileCreate).not.toHaveBeenCalled();
    expect(mocks.attemptUpsert).toHaveBeenCalled();
  });

  it("rejects a code that matches more than one pending invitation", async () => {
    const code = "Acme-Join-2026";
    const codeHash = await hashBindingCode(code);
    const invite = (id: string) => ({
      id,
      email: "user@example.com",
      workspaceId: `workspace-${id}`,
      roleId: "member-a",
      expiresAt: future,
      workspace: { bindingCodeHash: codeHash, defaultRoleId: "member-a" },
    });
    mocks.inviteFindMany
      .mockResolvedValueOnce([
        { status: "pending", workspace: { bindingCodeHash: codeHash } },
        { status: "pending", workspace: { bindingCodeHash: codeHash } },
      ])
      .mockResolvedValueOnce([invite("a"), invite("b")]);

    await expect(
      bindUserToWorkspace({
        userId: "user-1",
        email: "user@example.com",
        bindingCode: code,
      }),
    ).rejects.toBeInstanceOf(BindingCodeAmbiguousError);
    expect(mocks.profileCreate).not.toHaveBeenCalled();
  });

  it("blocks the fifth invalid attempt and records the limit atomically", async () => {
    const codeHash = await hashBindingCode("Acme-Join-2026");
    const invite = {
      id: "invite-a",
      email: "user@example.com",
      workspaceId: "workspace-a",
      roleId: "member-a",
      expiresAt: future,
      workspace: { bindingCodeHash: codeHash, defaultRoleId: "member-a" },
    };
    mocks.inviteFindMany
      .mockResolvedValueOnce([{ status: "pending", workspace: { bindingCodeHash: codeHash } }])
      .mockResolvedValueOnce([invite]);
    mocks.attemptFindUnique.mockResolvedValue({
      userId: "user-1",
      attemptCount: 5,
      windowStartedAt: new Date(),
      blockedUntil: null,
    });

    await expect(
      bindUserToWorkspace({
        userId: "user-1",
        email: "user@example.com",
        bindingCode: "Wrong-Code",
      }),
    ).rejects.toBeInstanceOf(BindingCodeRateLimitError);
    expect(mocks.attemptUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          attemptCount: { lt: 5 },
        }),
        data: expect.objectContaining({
          attemptCount: { increment: 1 },
        }),
      }),
    );
  });

  it("reuses a profile created by a concurrent binding request", async () => {
    const code = "Acme-Join-2026";
    const codeHash = await hashBindingCode(code);
    const invite = {
      id: "invite-a",
      email: "user@example.com",
      workspaceId: "workspace-a",
      roleId: "member-a",
      expiresAt: future,
      workspace: { bindingCodeHash: codeHash, defaultRoleId: "member-a" },
    };
    mocks.inviteFindMany
      .mockResolvedValueOnce([{ status: "pending", workspace: { bindingCodeHash: codeHash } }])
      .mockResolvedValueOnce([invite]);
    mocks.profileFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "user-1", tenantId: "workspace-a" });
    mocks.transaction.mockRejectedValue({ code: "P2002" });

    await expect(
      bindUserToWorkspace({
        userId: "user-1",
        email: "user@example.com",
        bindingCode: code,
      }),
    ).resolves.toMatchObject({
      profile: { id: "user-1", tenantId: "workspace-a" },
      invite: null,
    });
    expect(mocks.attemptDelete).toHaveBeenCalledWith({ where: { userId: "user-1" } });
  });

  it("does not resurrect an invite cancelled during binding", async () => {
    const code = "Acme-Join-2026";
    const codeHash = await hashBindingCode(code);
    const invite = {
      id: "invite-a",
      email: "user@example.com",
      workspaceId: "workspace-a",
      roleId: "member-a",
      expiresAt: future,
      workspace: { bindingCodeHash: codeHash, defaultRoleId: "member-a" },
    };
    mocks.inviteFindMany
      .mockResolvedValueOnce([{ status: "pending", workspace: { bindingCodeHash: codeHash } }])
      .mockResolvedValueOnce([invite]);
    mocks.inviteFindUnique.mockResolvedValue({
      ...invite,
      status: "pending",
    });
    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        profile: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn(),
        },
        invite: {
          findUnique: mocks.inviteFindUnique,
          update: vi.fn().mockRejectedValue({ code: "P2025" }),
          updateMany: vi.fn(),
        },
      }),
    );

    await expect(
      bindUserToWorkspace({
        userId: "user-1",
        email: "user@example.com",
        bindingCode: code,
      }),
    ).rejects.toBeInstanceOf(InviteNotFoundError);
  });

  it("does not bind when onboarding is waiting for workspace setup", async () => {
    mocks.inviteFindMany.mockResolvedValue([
      { status: "pending", workspace: { bindingCodeHash: null } },
    ]);

    await expect(
      bindUserToWorkspace({
        userId: "user-1",
        email: "user@example.com",
        bindingCode: "Acme-Join-2026",
      }),
    ).rejects.toMatchObject({ state: { status: "binding_setup_required" } } as OnboardingRequiredError);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
