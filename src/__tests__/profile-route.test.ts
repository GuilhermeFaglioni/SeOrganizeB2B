import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const mocks = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockProfileFindUnique: vi.fn(),
  mockProfileUpdate: vi.fn(),
  mockCreateProfileWithWorkspace: vi.fn(),
  mockGetOnboardingStatus: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getUser: mocks.mockGetUser,
  createClient: vi.fn(),
}));

vi.mock("../../prisma/client", () => ({
  prisma: {
    profile: {
      findUnique: mocks.mockProfileFindUnique,
      update: mocks.mockProfileUpdate,
    },
  },
}));

vi.mock("@/lib/authz/workspace-setup", () => ({
  createProfileWithWorkspace: mocks.mockCreateProfileWithWorkspace,
}));

vi.mock("@/lib/invites/service", () => ({
  getOnboardingStatus: mocks.mockGetOnboardingStatus,
}));

import { GET } from "../app/api/profile/route";

describe("GET /api/profile onboarding", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.mockGetUser.mockResolvedValue({
      id: "user-1",
      email: "joao@acme.com",
      user_metadata: { full_name: "João Silva" },
    });
    mocks.mockGetOnboardingStatus.mockResolvedValue({
      status: "workspace_creation_required",
    });
  });

  it("creates a fresh workspace-backed profile for a brand-new user", async () => {
    mocks.mockProfileFindUnique.mockResolvedValue(null);
    mocks.mockCreateProfileWithWorkspace.mockResolvedValue({
      id: "user-1",
      email: "joao@acme.com",
      name: "João Silva",
      tenantId: "ws-new",
      roleId: "admin-1",
    });

    const res = await GET();

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.tenantId).toBe("ws-new");
    expect(mocks.mockCreateProfileWithWorkspace).toHaveBeenCalledWith({
      id: "user-1",
      email: "joao@acme.com",
      name: "João Silva",
    });
    expect(mocks.mockProfileUpdate).not.toHaveBeenCalled();
  });

  it("only refreshes the email for an existing profile", async () => {
    mocks.mockProfileFindUnique.mockResolvedValue({ id: "user-1" });
    mocks.mockProfileUpdate.mockResolvedValue({
      id: "user-1",
      email: "joao@acme.com",
    });

    const res = await GET();

    expect(res.status).toBe(200);
    expect(mocks.mockProfileUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { email: "joao@acme.com" },
    });
    expect(mocks.mockCreateProfileWithWorkspace).not.toHaveBeenCalled();
  });

  it("normalizes the authenticated email before provisioning", async () => {
    mocks.mockGetUser.mockResolvedValue({
      id: "user-1",
      email: "  Joao@Acme.COM ",
      user_metadata: { full_name: "João Silva" },
    });
    mocks.mockProfileFindUnique.mockResolvedValue(null);
    mocks.mockCreateProfileWithWorkspace.mockResolvedValue({ id: "user-1" });

    await GET();

    expect(mocks.mockGetOnboardingStatus).toHaveBeenCalledWith({
      userId: "user-1",
      email: "joao@acme.com",
    });
    expect(mocks.mockCreateProfileWithWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({ email: "joao@acme.com" }),
    );
  });

  it("does not create a workspace while a binding code is required", async () => {
    mocks.mockProfileFindUnique.mockResolvedValue(null);
    mocks.mockGetOnboardingStatus.mockResolvedValue({
      status: "binding_required",
      reason: "pending_invite",
    });

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error.code).toBe("ONBOARDING_REQUIRED");
    expect(json.data).toEqual({
      status: "binding_required",
      reason: "pending_invite",
    });
    expect(mocks.mockCreateProfileWithWorkspace).not.toHaveBeenCalled();
  });

  it("recovers when another request creates the profile concurrently", async () => {
    mocks.mockProfileFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "user-1", tenantId: "ws-new" });
    mocks.mockCreateProfileWithWorkspace.mockRejectedValue({ code: "P2002" });

    const res = await GET();

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual({ id: "user-1", tenantId: "ws-new" });
  });

  it("does not connect new users to a shared default workspace", () => {
    const source = readFileSync(
      resolve(__dirname, "../app/api/profile/route.ts"),
      "utf8"
    );
    expect(source).not.toContain("DEFAULT_WORKSPACE_ID");
    expect(source).toContain("createProfileWithWorkspace");
  });
});
