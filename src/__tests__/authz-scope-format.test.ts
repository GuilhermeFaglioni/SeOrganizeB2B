import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  normalizePermissions,
  permissionKey,
  allScopedPermissions,
  type ScopedPermission,
} from "../lib/authz/permissions";
import {
  hasPermission,
  type EffectivePermissions,
} from "../lib/authz/authz";

const mocks = vi.hoisted(() => ({
  mockProfileFindFirst: vi.fn(),
  mockWorkspaceFindUnique: vi.fn(),
  mockRoleFindFirst: vi.fn(),
}));

vi.mock("../../prisma/client", () => ({
  prisma: {
    profile: { findFirst: mocks.mockProfileFindFirst },
    workspace: { findUnique: mocks.mockWorkspaceFindUnique },
    role: { findFirst: mocks.mockRoleFindFirst },
  },
  withTenant: (_tenantId: string, fn: () => unknown) => fn(),
}));

vi.mock("../lib/tenant", () => ({
  isWorkspaceAccessBlocked: () => false,
}));

const effective = (
  permissions: ScopedPermission[],
  isAdmin = false
): EffectivePermissions => ({
  tenantId: "tenant-1",
  isAdmin,
  roleId: "r1",
  roleName: "Member",
  permissions,
});

describe("normalizePermissions", () => {
  it("converts legacy string permissions to scope all", () => {
    expect(normalizePermissions(["tasks.view", "financial.contracts.create"])).toEqual(
      [
        { resource: "tasks", action: "view", scope: "all" },
        { resource: "financial.contracts", action: "create", scope: "all" },
      ]
    );
  });

  it("splits nested special permissions on the last dot", () => {
    expect(
      normalizePermissions(["financial.contracts.lifecycle", "financial.proposals.send"])
    ).toEqual([
      { resource: "financial.contracts", action: "lifecycle", scope: "all" },
      { resource: "financial.proposals", action: "send", scope: "all" },
    ]);
  });

  it("stores single-token special permissions with an empty resource", () => {
    expect(normalizePermissions(["manage_roles"])).toEqual([
      { resource: "", action: "manage_roles", scope: "all" },
    ]);
  });

  it("round-trips the legacy key via permissionKey", () => {
    for (const key of ["tasks.view", "financial.contracts.lifecycle", "manage_roles"]) {
      const [permission] = normalizePermissions([key]);
      expect(permissionKey(permission)).toBe(key);
    }
  });

  it("passes scoped objects through and validates them", () => {
    expect(
      normalizePermissions([
        { resource: "tasks", action: "view", scope: "area" },
        { resource: "projects", action: "edit", scope: "project" },
      ])
    ).toEqual([
      { resource: "tasks", action: "view", scope: "area" },
      { resource: "projects", action: "edit", scope: "project" },
    ]);
  });

  it("defaults an invalid scope to all", () => {
    expect(
      normalizePermissions([{ resource: "tasks", action: "view", scope: "planet" }])
    ).toEqual([{ resource: "tasks", action: "view", scope: "all" }]);
  });

  it("drops invalid entries and dedupes", () => {
    expect(
      normalizePermissions(["tasks.view", "tasks.view", "bogus.thing", 42])
    ).toEqual([{ resource: "tasks", action: "view", scope: "all" }]);
  });

  it("returns an empty array for non-array input", () => {
    expect(normalizePermissions(null)).toEqual([]);
    expect(normalizePermissions(undefined)).toEqual([]);
    expect(normalizePermissions("tasks.view")).toEqual([]);
  });

  it("allScopedPermissions covers the whole catalog with scope all", () => {
    const scoped = allScopedPermissions();
    expect(scoped.length).toBeGreaterThan(0);
    expect(scoped.every((p) => p.scope === "all")).toBe(true);
    expect(scoped.map(permissionKey)).toContain("tasks.view");
    expect(scoped.map(permissionKey)).toContain("financial.contracts.lifecycle");
    expect(scoped.map(permissionKey)).toContain("manage_roles");
  });
});

describe("hasPermission (sync, scoped)", () => {
  it("grants when permission scope covers the requested scope", () => {
    const eff = effective([
      { resource: "tasks", action: "view", scope: "all" },
    ]);
    expect(hasPermission(eff, { resource: "tasks", action: "view", scope: "all" })).toBe(true);
    expect(hasPermission(eff, { resource: "tasks", action: "view", scope: "area" })).toBe(true);
    expect(hasPermission(eff, { resource: "tasks", action: "view", scope: "project" })).toBe(true);
  });

  it("area scope covers area and project but not all", () => {
    const eff = effective([
      { resource: "tasks", action: "view", scope: "area" },
    ]);
    expect(hasPermission(eff, { resource: "tasks", action: "view", scope: "area" })).toBe(true);
    expect(hasPermission(eff, { resource: "tasks", action: "view", scope: "project" })).toBe(true);
    expect(hasPermission(eff, { resource: "tasks", action: "view", scope: "all" })).toBe(false);
  });

  it("project scope covers only project", () => {
    const eff = effective([
      { resource: "tasks", action: "view", scope: "project" },
    ]);
    expect(hasPermission(eff, { resource: "tasks", action: "view", scope: "project" })).toBe(true);
    expect(hasPermission(eff, { resource: "tasks", action: "view", scope: "area" })).toBe(false);
    expect(hasPermission(eff, { resource: "tasks", action: "view", scope: "all" })).toBe(false);
  });

  it("defaults the requested scope to all", () => {
    const eff = effective([
      { resource: "tasks", action: "view", scope: "all" },
    ]);
    expect(hasPermission(eff, { resource: "tasks", action: "view" })).toBe(true);
    const areaEff = effective([
      { resource: "tasks", action: "view", scope: "area" },
    ]);
    expect(hasPermission(areaEff, { resource: "tasks", action: "view" })).toBe(false);
  });

  it("does not match a different action or resource", () => {
    const eff = effective([
      { resource: "tasks", action: "view", scope: "all" },
    ]);
    expect(hasPermission(eff, { resource: "tasks", action: "create", scope: "all" })).toBe(false);
    expect(hasPermission(eff, { resource: "projects", action: "view", scope: "all" })).toBe(false);
  });

  it("bypasses scope checks for admins", () => {
    const eff = effective([], true);
    expect(hasPermission(eff, { resource: "tasks", action: "view", scope: "all" })).toBe(true);
    expect(hasPermission(eff, { resource: "bogus", action: "thing", scope: "all" })).toBe(true);
  });
});

describe("hasPermission (sync, backward compat string keys)", () => {
  it("matches a legacy string key against scoped permissions at any scope", () => {
    const eff = effective([
      { resource: "tasks", action: "view", scope: "area" },
    ]);
    expect(hasPermission(eff, "tasks.view")).toBe(true);
  });

  it("rejects a missing string key", () => {
    const eff = effective([
      { resource: "tasks", action: "view", scope: "all" },
    ]);
    expect(hasPermission(eff, "tasks.create")).toBe(false);
  });

  it("matches single-token special permissions", () => {
    const eff = effective([
      { resource: "", action: "manage_roles", scope: "all" },
    ]);
    expect(hasPermission(eff, "manage_roles")).toBe(true);
  });

  it("admins pass string key checks", () => {
    const eff = effective([], true);
    expect(hasPermission(eff, "manage_roles")).toBe(true);
    expect(hasPermission(eff, "anything.here")).toBe(true);
  });
});

describe("hasPermission (async, by userId)", () => {
  beforeEach(() => {
    mocks.mockProfileFindFirst.mockReset();
    mocks.mockWorkspaceFindUnique.mockReset();
    mocks.mockRoleFindFirst.mockReset();
  });

  it("resolves the user's effective permissions and checks scope", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue({
      id: "user-1",
      tenantId: "tenant-1",
      role: {
        id: "r1",
        name: "Member",
        isAdmin: false,
        permissions: [{ resource: "tasks", action: "view", scope: "area" }],
        tenantId: "tenant-1",
      },
    });
    await expect(
      hasPermission("user-1", { resource: "tasks", action: "view", scope: "area" })
    ).resolves.toBe(true);
    await expect(
      hasPermission("user-1", { resource: "tasks", action: "view", scope: "all" })
    ).resolves.toBe(false);
  });

  it("returns false for a user without a role", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue({
      id: "user-1",
      tenantId: null,
      role: null,
    });
    await expect(
      hasPermission("user-1", { resource: "tasks", action: "view", scope: "all" })
    ).resolves.toBe(false);
  });
});