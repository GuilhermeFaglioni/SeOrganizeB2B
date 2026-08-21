import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetEffectivePermissions: vi.fn(),
  mockProfileFindFirst: vi.fn(),
  mockWorkspaceFindUnique: vi.fn(),
  mockRoleFindFirst: vi.fn(),
  mockInviteFindFirst: vi.fn(),
  mockInviteFindMany: vi.fn(),
  mockInviteFindUnique: vi.fn(),
  mockInviteCreate: vi.fn(),
  mockInviteUpdateMany: vi.fn(),
  mockInviteUpdate: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getUser: mocks.mockGetUser,
}));

vi.mock("@/lib/authz/authz", () => ({
  getEffectivePermissions: mocks.mockGetEffectivePermissions,
  denyFor: vi.fn(async () => {
    const eff = await mocks.mockGetEffectivePermissions();
    if (eff?.isAdmin) return null;
    const has = eff?.permissions?.some?.(
      (p: { resource: string; action: string }) => `${p.resource}.${p.action}` === "manage_roles" || p.action === "manage_roles",
    );
    if (has) return null;
    if (!eff?.isAdmin) {
      return { status: 403, json: async () => ({ data: null, error: { code: "FORBIDDEN" } }) } as unknown as Response;
    }
    return null;
  }),
}));

vi.mock("../../prisma/client", () => ({
  prisma: {
    profile: {
      findFirst: mocks.mockProfileFindFirst,
    },
    workspace: { findUnique: mocks.mockWorkspaceFindUnique },
    role: { findFirst: mocks.mockRoleFindFirst },
    invite: {
      findFirst: mocks.mockInviteFindFirst,
      findMany: mocks.mockInviteFindMany,
      findUnique: mocks.mockInviteFindUnique,
      create: mocks.mockInviteCreate,
      updateMany: mocks.mockInviteUpdateMany,
      update: mocks.mockInviteUpdate,
    },
  },
  withTenant: (_tenantId: string, fn: () => unknown) => fn(),
  withTenantBypass: (fn: () => unknown) => fn(),
}));

import { GET as listInvitesGET, POST as createInvitePOST } from "../app/api/workspace/invites/route";
import { DELETE as cancelInviteDELETE } from "../app/api/workspace/invites/[id]/route";

const makeRequest = (url: string, body?: unknown) =>
  new NextRequest(url, {
    method: body !== undefined ? "POST" : "GET",
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { "content-type": "application/json" },
  });

const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

describe("workspace invites API", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.mockGetUser.mockResolvedValue({ id: "user-1", email: "admin@x.com" });
    mocks.mockGetEffectivePermissions.mockResolvedValue({
      isAdmin: true,
      roleId: "admin-role",
      roleName: "Admin",
      permissions: [],
    });
    // getWorkspaceIdForUser resolves the workspace id from the profile lookup.
    mocks.mockProfileFindFirst.mockImplementation((args: { where?: { id?: string } }) =>
      Promise.resolve(args?.where?.id ? { tenantId: "ws-1" } : null)
    );
    mocks.mockWorkspaceFindUnique.mockResolvedValue({
      id: "ws-1",
      name: "Acme",
      defaultRoleId: "default-role",
      bindingCodeHash: "configured-code-hash",
    });
    mocks.mockRoleFindFirst.mockResolvedValue({ id: "r2" });
    mocks.mockInviteUpdateMany.mockResolvedValue({ count: 0 });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("creates an invite as an admin without sending email", async () => {
    mocks.mockInviteFindFirst.mockResolvedValue(null);
    mocks.mockInviteCreate.mockResolvedValue({
      id: "inv-1",
      workspaceId: "ws-1",
      email: "colleague@example.com",
      roleId: "r2",
      token: "tok",
      status: "pending",
      expiresAt: future,
    });
    const res = await createInvitePOST(
      makeRequest("http://x/api/workspace/invites", {
        email: "Colleague@Example.com",
        roleId: "r2",
      })
    );

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.email).toBe("colleague@example.com");
    expect(json.data.token).toBeUndefined();
    expect(mocks.mockInviteCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceId: "ws-1",
          email: "colleague@example.com",
          roleId: "r2",
          status: "pending",
        }),
      })
    );
  });

  it("auto-fills the workspace default role when no roleId is provided", async () => {
    mocks.mockInviteFindFirst.mockResolvedValue(null);
    mocks.mockInviteCreate.mockResolvedValue({
      id: "inv-2",
      workspaceId: "ws-1",
      email: "solo@invite.com",
      roleId: "default-role",
      token: "tok2",
      status: "pending",
      expiresAt: future,
    });
    const res = await createInvitePOST(
      makeRequest("http://x/api/workspace/invites", {
        email: "solo@invite.com",
      })
    );

    expect(res.status).toBe(201);
    expect(mocks.mockInviteCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceId: "ws-1",
          email: "solo@invite.com",
          roleId: "default-role",
          status: "pending",
        }),
      })
    );
  });

  it("rejects an invite when the workspace has no binding code", async () => {
    mocks.mockWorkspaceFindUnique.mockResolvedValue({
      id: "ws-1",
      name: "Acme",
      defaultRoleId: "default-role",
      bindingCodeHash: null,
    });

    const res = await createInvitePOST(
      makeRequest("http://x/api/workspace/invites", {
        email: "new@example.com",
      }),
    );

    expect(res.status).toBe(400);
    expect(mocks.mockInviteCreate).not.toHaveBeenCalled();
  });

  it("cancels a pending invite as an admin", async () => {
    mocks.mockInviteFindUnique.mockResolvedValue({
      id: "inv-cancel",
      workspaceId: "ws-1",
      status: "pending",
    });
    mocks.mockInviteUpdate.mockResolvedValue({
      id: "inv-cancel",
      token: "secret-token",
      status: "cancelled",
    });

    const res = await cancelInviteDELETE(
      makeRequest("http://x/api/workspace/invites/inv-cancel"),
      { params: Promise.resolve({ id: "inv-cancel" }) } as never,
    );

    expect(res.status).toBe(200);
    expect((await res.json()).data.token).toBeUndefined();
    expect(mocks.mockInviteUpdate).toHaveBeenCalledWith({
      where: {
        id: "inv-cancel",
        status: { in: ["pending", "expired"] },
      },
      data: { status: "cancelled" },
    });
  });

  it("uses explicit roleId over workspace default when both are present", async () => {
    mocks.mockInviteFindFirst.mockResolvedValue(null);
    mocks.mockInviteCreate.mockResolvedValue({
      id: "inv-3",
      workspaceId: "ws-1",
      email: "explicit@invite.com",
      roleId: "r2",
      token: "tok3",
      status: "pending",
      expiresAt: future,
    });
    const res = await createInvitePOST(
      makeRequest("http://x/api/workspace/invites", {
        email: "explicit@invite.com",
        roleId: "r2",
      })
    );

    expect(res.status).toBe(201);
    expect(mocks.mockInviteCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          roleId: "r2",
        }),
      })
    );
  });

  it("returns 403 when a non-admin tries to create an invite", async () => {
    mocks.mockGetEffectivePermissions.mockResolvedValue({
      isAdmin: false,
      roleId: "editor-role",
      roleName: "Editor",
      permissions: [],
    });

    const res = await createInvitePOST(
      makeRequest("http://x/api/workspace/invites", { email: "x@y.z" })
    );

    expect(res.status).toBe(403);
    expect(mocks.mockInviteCreate).not.toHaveBeenCalled();
  });

  it("returns 403 when a non-admin lists invites", async () => {
    mocks.mockGetEffectivePermissions.mockResolvedValue({
      isAdmin: false,
      roleId: "editor-role",
      roleName: "Editor",
      permissions: [],
    });

    const res = await listInvitesGET();

    expect(res.status).toBe(403);
    expect(mocks.mockInviteFindMany).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid email", async () => {
    const res = await createInvitePOST(
      makeRequest("http://x/api/workspace/invites", { email: "not-an-email" })
    );

    expect(res.status).toBe(400);
    expect(mocks.mockInviteCreate).not.toHaveBeenCalled();
  });

  it("returns 400 when the email is already invited", async () => {
    mocks.mockInviteFindFirst.mockResolvedValue({ id: "inv-1" });

    const res = await createInvitePOST(
      makeRequest("http://x/api/workspace/invites", { email: "x@y.z" })
    );

    expect(res.status).toBe(400);
    expect(mocks.mockInviteCreate).not.toHaveBeenCalled();
  });

  it("returns 400 when the email is already a member", async () => {
    mocks.mockProfileFindFirst.mockImplementation((args: { where?: { id?: string } }) =>
      Promise.resolve(args?.where?.id ? { tenantId: "ws-1" } : { id: "p1" })
    );

    const res = await createInvitePOST(
      makeRequest("http://x/api/workspace/invites", { email: "x@y.z" })
    );

    expect(res.status).toBe(400);
    expect(mocks.mockInviteCreate).not.toHaveBeenCalled();
  });

  it("returns 400 when the role does not belong to the workspace", async () => {
    mocks.mockRoleFindFirst.mockResolvedValue(null);

    const res = await createInvitePOST(
      makeRequest("http://x/api/workspace/invites", { email: "x@y.z", roleId: "foreign" })
    );

    expect(res.status).toBe(400);
    expect(mocks.mockInviteCreate).not.toHaveBeenCalled();
  });

  it("lists pending invites", async () => {
    mocks.mockInviteFindMany.mockResolvedValue([
      {
        id: "inv-1",
        email: "a@b.c",
        status: "pending",
        roleId: "r2",
        createdAt: new Date("2026-08-11T10:00:00Z"),
        expiresAt: future,
      },
    ]);

    const res = await listInvitesGET();

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveLength(1);
    expect(json.data[0].email).toBe("a@b.c");
    expect(mocks.mockInviteFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          workspaceId: "ws-1",
          status: { in: ["pending", "expired"] },
        },
      })
    );
  });

});
