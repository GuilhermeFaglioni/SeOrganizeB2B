import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  mockGetTenantContext: vi.fn(),
  mockGetSuperAdminStatus: vi.fn(),
  mockCheckFeature: vi.fn(),
  mockCheckLimit: vi.fn(),
}));

vi.mock("@/lib/authz/tenant-context", () => ({
  getTenantContext: mocks.mockGetTenantContext,
}));

vi.mock("@/lib/admin/super-admin", () => ({
  getSuperAdminStatus: mocks.mockGetSuperAdminStatus,
}));

vi.mock("@/lib/features", () => ({
  checkFeature: mocks.mockCheckFeature,
  checkLimit: mocks.mockCheckLimit,
}));

import {
  resourceForOp,
  enforceFeatureGate,
  applyFeatureGate,
  withFeatureWarning,
  FEATURE_WARNING_HEADER,
  FEATURE_BLOCKED_CODE,
  LIMIT_REACHED_CODE,
} from "../lib/middleware/feature-gating";

const nonAdmin = {
  tenantId: "ws_1",
  workspaceStatus: "active",
  gracePeriodEndsAt: null,
  cancelledAt: null,
  isAdmin: false,
};

const admin = { ...nonAdmin, isAdmin: true };

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.mockGetSuperAdminStatus.mockResolvedValue(false);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("enforceFeatureGate (gaps)", () => {
  it("returns a 403 FEATURE_BLOCKED decision when the module is not enabled", async () => {
    mocks.mockCheckFeature.mockResolvedValue(false);

    const decision = await enforceFeatureGate({
      userId: "u1",
      pathname: "/api/documents",
      method: "GET",
      tenantContext: nonAdmin,
    });

    expect(decision).toEqual({
      ok: false,
      status: 403,
      code: FEATURE_BLOCKED_CODE,
      error: expect.stringContaining("documents"),
    });
  });

  it("returns a 403 LIMIT_REACHED decision when a hard limit is reached", async () => {
    mocks.mockCheckFeature.mockResolvedValue(true);
    mocks.mockCheckLimit.mockResolvedValue({
      remaining: 0,
      limit: 5,
      behavior: "hard",
    });

    const decision = await enforceFeatureGate({
      userId: "u1",
      pathname: "/api/projects",
      method: "POST",
      tenantContext: nonAdmin,
    });

    expect(decision).toEqual({
      ok: false,
      status: 403,
      code: LIMIT_REACHED_CODE,
      error: expect.stringContaining("projects"),
    });
  });

  it("does not warn when a warning limit has a non-finite limit", async () => {
    mocks.mockCheckFeature.mockResolvedValue(true);
    mocks.mockCheckLimit.mockResolvedValue({
      remaining: 5,
      limit: Number.POSITIVE_INFINITY,
      behavior: "warning",
    });

    const decision = await enforceFeatureGate({
      userId: "u1",
      pathname: "/api/tasks",
      method: "POST",
      tenantContext: nonAdmin,
    });

    expect(decision).toEqual({ ok: true });
  });

  it("does not warn when the warning ratio is exactly at the threshold", async () => {
    mocks.mockCheckFeature.mockResolvedValue(true);
    mocks.mockCheckLimit.mockResolvedValue({
      remaining: 20,
      limit: 100,
      behavior: "warning",
    });

    const decision = await enforceFeatureGate({
      userId: "u1",
      pathname: "/api/tasks",
      method: "POST",
      tenantContext: nonAdmin,
    });

    expect(decision).toEqual({ ok: true });
  });

  it("bypasses for workspace admins even when the module is disabled", async () => {
    mocks.mockCheckFeature.mockResolvedValue(false);

    const decision = await enforceFeatureGate({
      userId: "u1",
      pathname: "/api/contracts",
      method: "GET",
      tenantContext: admin,
    });

    expect(decision).toEqual({ ok: true });
    expect(mocks.mockCheckFeature).not.toHaveBeenCalled();
  });

  it("bypasses for super-admins even when the module is disabled", async () => {
    mocks.mockGetSuperAdminStatus.mockResolvedValue(true);
    mocks.mockCheckFeature.mockResolvedValue(false);

    const decision = await enforceFeatureGate({
      userId: "u1",
      pathname: "/api/contracts",
      method: "GET",
      tenantContext: nonAdmin,
    });

    expect(decision).toEqual({ ok: true });
    expect(mocks.mockCheckFeature).not.toHaveBeenCalled();
  });

  it("allows unmapped paths without any feature check", async () => {
    const decision = await enforceFeatureGate({
      userId: "u1",
      pathname: "/api/me",
      method: "GET",
      tenantContext: nonAdmin,
    });

    expect(decision).toEqual({ ok: true });
    expect(mocks.mockCheckFeature).not.toHaveBeenCalled();
    expect(mocks.mockGetSuperAdminStatus).not.toHaveBeenCalled();
  });
});

describe("resourceForOp (gaps)", () => {
  it("treats lowercase write methods as writes", () => {
    expect(resourceForOp("/api/tasks", "post")).toBe("tasks");
    expect(resourceForOp("/api/clients", "patch")).toBe("clients");
  });
});

describe("applyFeatureGate (gaps)", () => {
  it("returns no response and no warning for unmapped paths", async () => {
    const result = await applyFeatureGate({
      userId: "u1",
      pathname: "/api/me",
      method: "GET",
      tenantContext: nonAdmin,
    });

    expect(result.response).toBeNull();
    expect(result.warning).toBeNull();
  });

  it("surfaces the warning value as the feature warning header", async () => {
    mocks.mockCheckFeature.mockResolvedValue(true);
    mocks.mockCheckLimit.mockResolvedValue({
      remaining: 3,
      limit: 100,
      behavior: "warning",
    });

    const { response, warning } = await applyFeatureGate({
      userId: "u1",
      pathname: "/api/tasks",
      method: "POST",
      tenantContext: nonAdmin,
    });

    expect(response).toBeNull();
    expect(warning).toBe("tasks:3");

    const out = withFeatureWarning(
      NextResponse.json({ data: null, error: null }),
      warning
    );
    expect(out.headers.get(FEATURE_WARNING_HEADER)).toBe("tasks:3");
  });
});