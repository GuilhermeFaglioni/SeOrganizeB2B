import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { allPermissions, MODULES } from "@/lib/authz/permissions";

const mocks = vi.hoisted(() => ({
  mockExchangeCodeForSession: vi.fn(),
  mockProfileFindUnique: vi.fn(),
  mockProfileUpdate: vi.fn(),
  mockProfileCreate: vi.fn(),
  mockWorkspaceFindUnique: vi.fn(),
  mockWorkspaceCreate: vi.fn(),
  mockWorkspaceUpdate: vi.fn(),
  mockRoleCreate: vi.fn(),
  mockPlanFindFirst: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { exchangeCodeForSession: mocks.mockExchangeCodeForSession },
  }),
}));

vi.mock("../../prisma/client", () => ({
  prisma: {
    profile: {
      findUnique: mocks.mockProfileFindUnique,
      update: mocks.mockProfileUpdate,
      create: mocks.mockProfileCreate,
    },
    workspace: {
      findUnique: mocks.mockWorkspaceFindUnique,
      create: mocks.mockWorkspaceCreate,
      update: mocks.mockWorkspaceUpdate,
    },
    role: { create: mocks.mockRoleCreate },
    plan: { findFirst: mocks.mockPlanFindFirst },
  },
}));

import { GET } from "../app/auth/callback/route";

const loggedInUser = {
  id: "user-1",
  email: "joao.silva@example.com",
  user_metadata: { full_name: "João Silva" },
};

const makeCallbackRequest = () =>
  new NextRequest("http://localhost:3000/auth/callback?code=test-code");

const MEMBER_MODULES = ["tasks", "projects", "calendar", "documents", "areas"];
const expectedMemberPermissions = MEMBER_MODULES.flatMap((module) =>
  MODULES[module].map((action) => `${module}.${action}`)
);

describe("GET /auth/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockExchangeCodeForSession.mockResolvedValue({
      data: { session: { user: loggedInUser } },
      error: null,
    });
  });

  it("redirects to /login when the code exchange fails", async () => {
    mocks.mockExchangeCodeForSession.mockResolvedValue({
      data: { session: null },
      error: { message: "invalid code" },
    });

    const res = await GET(makeCallbackRequest());

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/login");
    expect(mocks.mockProfileFindUnique).not.toHaveBeenCalled();
  });

  it("creates a workspace, default roles and links the profile on first login", async () => {
    mocks.mockProfileFindUnique.mockResolvedValue(null);
    mocks.mockPlanFindFirst.mockResolvedValue({ id: "plan-1", isDefault: true });
    mocks.mockWorkspaceFindUnique.mockResolvedValue(null);
    mocks.mockWorkspaceCreate.mockResolvedValue({
      id: "ws-1",
      slug: "joao-silva",
      name: "João Silva",
    });
    mocks.mockRoleCreate
      .mockResolvedValueOnce({ id: "admin-1", name: "Admin" })
      .mockResolvedValueOnce({ id: "member-1", name: "Member" });
    mocks.mockWorkspaceUpdate.mockResolvedValue({
      id: "ws-1",
      defaultRoleId: "member-1",
    });
    mocks.mockProfileCreate.mockResolvedValue({ id: "user-1", tenantId: "ws-1" });

    const res = await GET(makeCallbackRequest());

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/");

    expect(mocks.mockWorkspaceCreate).toHaveBeenCalledWith({
      data: { name: "João Silva", slug: "joao-silva", planId: "plan-1" },
    });
    expect(mocks.mockWorkspaceUpdate).toHaveBeenCalledWith({
      where: { id: "ws-1" },
      data: { defaultRoleId: "member-1" },
    });
    expect(mocks.mockProfileCreate).toHaveBeenCalledWith({
      data: {
        id: "user-1",
        email: "joao.silva@example.com",
        name: "João Silva",
        tenantId: "ws-1",
        roleId: "admin-1",
      },
    });
  });

  it("appends a numeric suffix when the base slug is already taken", async () => {
    mocks.mockProfileFindUnique.mockResolvedValue(null);
    mocks.mockPlanFindFirst.mockResolvedValue(null);
    mocks.mockWorkspaceFindUnique
      .mockResolvedValueOnce({ id: "ws-0", slug: "joao-silva" })
      .mockResolvedValueOnce({ id: "ws-0", slug: "joao-silva-2" })
      .mockResolvedValueOnce(null);
    mocks.mockWorkspaceCreate.mockResolvedValue({
      id: "ws-1",
      slug: "joao-silva-3",
    });
    mocks.mockRoleCreate
      .mockResolvedValueOnce({ id: "admin-1" })
      .mockResolvedValueOnce({ id: "member-1" });
    mocks.mockWorkspaceUpdate.mockResolvedValue({ id: "ws-1" });
    mocks.mockProfileCreate.mockResolvedValue({ id: "user-1" });

    await GET(makeCallbackRequest());

    expect(mocks.mockWorkspaceCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ slug: "joao-silva-3" }),
    });
  });

  it("does not create a workspace on subsequent logins", async () => {
    mocks.mockProfileFindUnique.mockResolvedValue({
      id: "user-1",
      tenantId: "ws-1",
    });
    mocks.mockProfileUpdate.mockResolvedValue({ id: "user-1" });

    const res = await GET(makeCallbackRequest());

    expect(res.status).toBe(307);
    expect(mocks.mockProfileUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { email: "joao.silva@example.com", name: "João Silva" },
    });
    expect(mocks.mockWorkspaceCreate).not.toHaveBeenCalled();
    expect(mocks.mockRoleCreate).not.toHaveBeenCalled();
    expect(mocks.mockProfileCreate).not.toHaveBeenCalled();
  });

  it("seeds Admin with all permissions and Member with scoped permissions", async () => {
    mocks.mockProfileFindUnique.mockResolvedValue(null);
    mocks.mockPlanFindFirst.mockResolvedValue(null);
    mocks.mockWorkspaceFindUnique.mockResolvedValue(null);
    mocks.mockWorkspaceCreate.mockResolvedValue({ id: "ws-1" });
    mocks.mockRoleCreate
      .mockResolvedValueOnce({ id: "admin-1" })
      .mockResolvedValueOnce({ id: "member-1" });
    mocks.mockWorkspaceUpdate.mockResolvedValue({ id: "ws-1" });
    mocks.mockProfileCreate.mockResolvedValue({ id: "user-1" });

    await GET(makeCallbackRequest());

    expect(mocks.mockRoleCreate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Admin",
          isAdmin: true,
          permissions: allPermissions(),
          tenantId: "ws-1",
        }),
      })
    );
    expect(mocks.mockRoleCreate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Member",
          isAdmin: false,
          permissions: expectedMemberPermissions,
          tenantId: "ws-1",
        }),
      })
    );
  });
});
