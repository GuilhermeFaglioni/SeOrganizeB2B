import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetEffectivePermissions: vi.fn(),
  mockProfileFindFirst: vi.fn(),
  mockProfileCreate: vi.fn(),
  mockWorkspaceFindUnique: vi.fn(),
  mockRoleFindFirst: vi.fn(),
  mockInviteFindFirst: vi.fn(),
  mockInviteFindMany: vi.fn(),
  mockInviteFindUnique: vi.fn(),
  mockInviteCreate: vi.fn(),
  mockInviteUpdate: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getUser: mocks.mockGetUser,
}));

vi.mock("@/lib/authz/authz", () => ({
  getEffectivePermissions: mocks.mockGetEffectivePermissions,
}));

vi.mock("../../prisma/client", () => ({
  prisma: {
    profile: {
      findFirst: mocks.mockProfileFindFirst,
      create: mocks.mockProfileCreate,
    },
    workspace: { findUnique: mocks.mockWorkspaceFindUnique },
    role: { findFirst: mocks.mockRoleFindFirst },
    invite: {
      findFirst: mocks.mockInviteFindFirst,
      findMany: mocks.mockInviteFindMany,
      findUnique: mocks.mockInviteFindUnique,
      create: mocks.mockInviteCreate,
      update: mocks.mockInviteUpdate,
    },
  },
  withTenant: (_tenantId: string, fn: () => unknown) => fn(),
  withTenantBypass: (fn: () => unknown) => fn(),
}));

import { GET as listInvitesGET, POST as createInvitePOST } from "../app/api/workspace/invites/route";
import { POST as acceptInvitePOST } from "../app/api/workspace/invites/[id]/accept/route";

const makeRequest = (url: string, body?: unknown) =>
  new NextRequest(url, {
    method: body !== undefined ? "POST" : "GET",
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { "content-type": "application/json" },
  });

const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const past = new Date(Date.now() - 1000);

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
    mocks.mockWorkspaceFindUnique.mockResolvedValue({ id: "ws-1", name: "Acme", defaultRoleId: "default-role" });
    mocks.mockRoleFindFirst.mockResolvedValue({ id: "r2" });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("creates an invite as an admin and sends the email", async () => {
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
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    const res = await createInvitePOST(
      makeRequest("http://x/api/workspace/invites", {
        email: "Colleague@Example.com",
        roleId: "r2",
      })
    );

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.email).toBe("colleague@example.com");
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
    expect(infoSpy).toHaveBeenCalled();
    infoSpy.mockRestore();
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
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

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
    infoSpy.mockRestore();
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
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

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
    infoSpy.mockRestore();
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
        where: { workspaceId: "ws-1", status: "pending" },
      })
    );
  });

  it("accepts an invite: creates a profile, links the workspace and marks it accepted", async () => {
    mocks.mockInviteFindUnique.mockResolvedValue({
      id: "inv-1",
      workspaceId: "ws-1",
      email: "colleague@example.com",
      roleId: "r2",
      status: "pending",
      expiresAt: future,
    });
    mocks.mockProfileFindFirst.mockImplementation((args: { where?: { id?: string } }) =>
      Promise.resolve(args?.where?.id ? { tenantId: "ws-1" } : null)
    );
    mocks.mockWorkspaceFindUnique.mockResolvedValue({ defaultRoleId: "r2" });
    mocks.mockProfileCreate.mockResolvedValue({
      id: "p1",
      email: "colleague@example.com",
      tenantId: "ws-1",
      roleId: "r2",
    });
    mocks.mockInviteUpdate.mockResolvedValue({
      id: "inv-1",
      status: "accepted",
      acceptedAt: new Date(),
    });

    const res = await acceptInvitePOST(makeRequest("http://x/api/workspace/invites/inv-1/accept"), {
      params: { id: "inv-1" },
    } as never);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.profile.tenantId).toBe("ws-1");
    expect(json.data.profile.roleId).toBe("r2");
    expect(mocks.mockProfileCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "colleague@example.com",
          tenantId: "ws-1",
          roleId: "r2",
        }),
      })
    );
    expect(mocks.mockInviteUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "accepted" }),
      })
    );
  });

  it("falls back to the workspace default role when the invite has no role", async () => {
    mocks.mockInviteFindUnique.mockResolvedValue({
      id: "inv-1",
      workspaceId: "ws-1",
      email: "colleague@example.com",
      roleId: null,
      status: "pending",
      expiresAt: future,
    });
    mocks.mockProfileFindFirst.mockImplementation((args: { where?: { id?: string } }) =>
      Promise.resolve(args?.where?.id ? { tenantId: "ws-1" } : null)
    );
    mocks.mockWorkspaceFindUnique.mockResolvedValue({ defaultRoleId: "default-role" });
    mocks.mockProfileCreate.mockResolvedValue({ id: "p1", roleId: "default-role" });
    mocks.mockInviteUpdate.mockResolvedValue({ id: "inv-1", status: "accepted" });

    const res = await acceptInvitePOST(makeRequest("http://x/api/workspace/invites/inv-1/accept"), {
      params: { id: "inv-1" },
    } as never);

    expect(res.status).toBe(200);
    expect(mocks.mockProfileCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ roleId: "default-role" }) })
    );
  });

  it("returns 404 when the invite is missing", async () => {
    mocks.mockInviteFindUnique.mockResolvedValue(null);

    const res = await acceptInvitePOST(makeRequest("http://x/api/workspace/invites/nope/accept"), {
      params: { id: "nope" },
    } as never);

    expect(res.status).toBe(404);
    expect(mocks.mockProfileCreate).not.toHaveBeenCalled();
  });

  it("returns 404 when the invite has expired", async () => {
    mocks.mockInviteFindUnique.mockResolvedValue({
      id: "inv-1",
      workspaceId: "ws-1",
      email: "colleague@example.com",
      roleId: null,
      status: "pending",
      expiresAt: past,
    });

    const res = await acceptInvitePOST(makeRequest("http://x/api/workspace/invites/inv-1/accept"), {
      params: { id: "inv-1" },
    } as never);

    expect(res.status).toBe(404);
    expect(mocks.mockProfileCreate).not.toHaveBeenCalled();
  });

  it("returns 409 when the email already has an account in the workspace", async () => {
    mocks.mockInviteFindUnique.mockResolvedValue({
      id: "inv-1",
      workspaceId: "ws-1",
      email: "colleague@example.com",
      roleId: null,
      status: "pending",
      expiresAt: future,
    });
    mocks.mockProfileFindFirst.mockImplementation((args: { where?: { id?: string } }) =>
      Promise.resolve(args?.where?.id ? { tenantId: "ws-1" } : { id: "p1" })
    );

    const res = await acceptInvitePOST(makeRequest("http://x/api/workspace/invites/inv-1/accept"), {
      params: { id: "inv-1" },
    } as never);

    expect(res.status).toBe(409);
    expect(mocks.mockProfileCreate).not.toHaveBeenCalled();
  });
});