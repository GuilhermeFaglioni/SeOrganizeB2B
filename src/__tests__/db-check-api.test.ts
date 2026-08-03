import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  profileFindFirst: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getUser: vi.fn().mockResolvedValue({ id: "profile-1" }),
}));

vi.mock("../../prisma/client", () => ({
  prisma: {
    $queryRaw: mocks.queryRaw,
    profile: { findFirst: mocks.profileFindFirst },
  },
}));

import { GET } from "../app/api/db-check/route";

describe("GET /api/db-check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = "postgresql://pooler.example:5432/app";
    process.env.DIRECT_URL = "postgresql://direct.example:6543/app";

    mocks.queryRaw.mockResolvedValue([
      {
        db: "app",
        user: "postgres",
        has_is_admin: true,
      },
    ]);
    mocks.profileFindFirst.mockImplementation(async (args) => {
      const roleSelect = args?.select?.role?.select;
      if (!roleSelect?.isAdmin) {
        throw new Error("diagnostic typed query did not select Role.isAdmin");
      }

      return {
        id: "profile-1",
        role: {
          id: "role-1",
          name: "Admin",
          isAdmin: true,
          permissions: [],
        },
      };
    });
  });

  it("checks isAdmin through the same profile-role query used by authorization", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.rawColumnPath).toEqual({ ok: true, error: null });
    expect(body.data.typedPath).toEqual({ ok: true, error: null });
  });
});
