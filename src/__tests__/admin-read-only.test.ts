import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetSuperAdminStatus: vi.fn(),
  mockWorkspaceFindFirst: vi.fn(),
  mockReadOnlyAccessCreate: vi.fn(),
  mockReadOnlyAccessFindUnique: vi.fn(),
  mockReadOnlyAccessUpdate: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getUser: mocks.mockGetUser,
}));

vi.mock("@/lib/admin/super-admin", () => ({
  getSuperAdminStatus: mocks.mockGetSuperAdminStatus,
}));

vi.mock("../../prisma/client", () => ({
  prisma: {
    workspace: { findFirst: mocks.mockWorkspaceFindFirst },
    readOnlyAccess: {
      create: mocks.mockReadOnlyAccessCreate,
      findUnique: mocks.mockReadOnlyAccessFindUnique,
      update: mocks.mockReadOnlyAccessUpdate,
    },
  },
  withTenant: vi.fn(async (_tenantId: string, fn: () => unknown) => fn()),
  withTenantBypass: vi.fn(async (fn: () => unknown) => fn()),
}));

import { POST as grantReadOnly } from "../app/api/admin/tenants/[id]/grant-read-only/route";
import {
  acceptReadOnlyAccess,
  ReadOnlyAccessExpiredError,
  ReadOnlyAccessUsedError,
} from "../lib/admin/read-only-service";

const makeUser = () => ({ id: "admin_1", email: "admin@example.com" });
const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const past = new Date(Date.now() - 1000);

const makeAccess = (overrides: Record<string, unknown> = {}) => ({
  id: "roa_1",
  token: "tok_123",
  workspaceId: "ws_1",
  email: "support@example.com",
  expiresAt: future,
  createdAt: new Date(),
  usedAt: null,
  workspace: { id: "ws_1", name: "Acme" },
  ...overrides,
});

const makeGrantRequest = (body?: unknown) =>
  new NextRequest("http://x/api/admin/tenants/ws_1/grant-read-only", {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { "content-type": "application/json" },
  });

const grantParams = { params: Promise.resolve({ id: "ws_1" }) };

function resetMocks() {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.mockGetUser.mockResolvedValue(makeUser());
  mocks.mockGetSuperAdminStatus.mockResolvedValue(true);
  mocks.mockWorkspaceFindFirst.mockResolvedValue({
    id: "ws_1",
    name: "Acme",
  });
}

beforeEach(resetMocks);

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/admin/tenants/[id]/grant-read-only", () => {
  it("grants read-only access with an expiry date", async () => {
    mocks.mockReadOnlyAccessCreate.mockImplementation(
      (args: { data: { token: string; expiresAt: Date } }) =>
        Promise.resolve({
          id: "roa_1",
          workspaceId: "ws_1",
          email: "support@example.com",
          token: args.data.token,
          expiresAt: args.data.expiresAt,
        })
    );
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    const before = Date.now();
    const res = await grantReadOnly(
      makeGrantRequest({ email: "Support@Example.com", expiresIn: 7 }),
      grantParams
    );
    const after = Date.now();

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.error).toBeNull();
    expect(json.data).toMatchObject({
      email: "support@example.com",
      url: `/accept-read-only/${json.data.token}`,
    });

    const [createArgs] = mocks.mockReadOnlyAccessCreate.mock.calls[0] as [
      { data: { workspaceId: string; email: string; token: string; expiresAt: Date } }
    ];
    expect(createArgs.data.workspaceId).toBe("ws_1");
    expect(createArgs.data.email).toBe("support@example.com");
    const expiry = createArgs.data.expiresAt.getTime();
    expect(expiry).toBeGreaterThanOrEqual(before + 7 * 24 * 60 * 60 * 1000);
    expect(expiry).toBeLessThanOrEqual(after + 7 * 24 * 60 * 60 * 1000);
    expect(createArgs.data.token).toMatch(/^[0-9a-f]{64}$/);

    expect(infoSpy).toHaveBeenCalled();
    infoSpy.mockRestore();
  });

  it("returns 403 for non-super-admins", async () => {
    mocks.mockGetSuperAdminStatus.mockResolvedValue(false);

    const res = await grantReadOnly(
      makeGrantRequest({ email: "a@b.c", expiresIn: 7 }),
      grantParams
    );

    expect(res.status).toBe(403);
    expect(mocks.mockWorkspaceFindFirst).not.toHaveBeenCalled();
    expect(mocks.mockReadOnlyAccessCreate).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid email", async () => {
    const res = await grantReadOnly(
      makeGrantRequest({ email: "not-an-email", expiresIn: 7 }),
      grantParams
    );

    expect(res.status).toBe(400);
    expect(mocks.mockReadOnlyAccessCreate).not.toHaveBeenCalled();
  });

  it("returns 404 when the tenant does not exist", async () => {
    mocks.mockWorkspaceFindFirst.mockResolvedValue(null);

    const res = await grantReadOnly(
      makeGrantRequest({ email: "a@b.c", expiresIn: 7 }),
      grantParams
    );

    expect(res.status).toBe(404);
    expect(mocks.mockReadOnlyAccessCreate).not.toHaveBeenCalled();
  });
});

describe("acceptReadOnlyAccess", () => {
  it("accepts a valid token, marks it used and returns the workspace", async () => {
    mocks.mockReadOnlyAccessFindUnique.mockResolvedValue(makeAccess());
    mocks.mockReadOnlyAccessUpdate.mockResolvedValue(
      makeAccess({ usedAt: new Date() })
    );

    const result = await acceptReadOnlyAccess("tok_123");

    expect(result).toMatchObject({
      workspaceId: "ws_1",
      workspaceName: "Acme",
      email: "support@example.com",
    });
    expect(mocks.mockReadOnlyAccessUpdate).toHaveBeenCalledWith({
      where: { id: "roa_1" },
      data: { usedAt: expect.any(Date) },
    });
  });

  it("rejects an expired token", async () => {
    mocks.mockReadOnlyAccessFindUnique.mockResolvedValue(
      makeAccess({ expiresAt: past })
    );

    await expect(acceptReadOnlyAccess("tok_123")).rejects.toBeInstanceOf(
      ReadOnlyAccessExpiredError
    );
    expect(mocks.mockReadOnlyAccessUpdate).not.toHaveBeenCalled();
  });

  it("rejects an already-used token", async () => {
    mocks.mockReadOnlyAccessFindUnique.mockResolvedValue(
      makeAccess({ usedAt: new Date() })
    );

    await expect(acceptReadOnlyAccess("tok_123")).rejects.toBeInstanceOf(
      ReadOnlyAccessUsedError
    );
    expect(mocks.mockReadOnlyAccessUpdate).not.toHaveBeenCalled();
  });
});
