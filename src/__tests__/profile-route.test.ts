import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const mocks = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockProfileFindUnique: vi.fn(),
  mockProfileUpdate: vi.fn(),
  mockCreateProfileWithWorkspace: vi.fn(),
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

import { GET } from "../app/api/profile/route";

describe("GET /api/profile onboarding", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.mockGetUser.mockResolvedValue({
      id: "user-1",
      email: "joao@acme.com",
      user_metadata: { full_name: "João Silva" },
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

  it("does not connect new users to a shared default workspace", () => {
    const source = readFileSync(
      resolve(__dirname, "../app/api/profile/route.ts"),
      "utf8"
    );
    expect(source).not.toContain("DEFAULT_WORKSPACE_ID");
    expect(source).toContain("createProfileWithWorkspace");
  });
});
