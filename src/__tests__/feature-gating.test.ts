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
  moduleForPath,
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

describe("moduleForPath", () => {
  it("maps base routes to their modules", () => {
    expect(moduleForPath("/api/tasks")).toBe("tasks");
    expect(moduleForPath("/api/projects")).toBe("projects");
    expect(moduleForPath("/api/calendar")).toBe("calendar");
    expect(moduleForPath("/api/documents")).toBe("documents");
    expect(moduleForPath("/api/contracts")).toBe("financial.contracts");
    expect(moduleForPath("/api/clients")).toBe("financial.clients");
    expect(moduleForPath("/api/proposals")).toBe("financial.proposals");
    expect(moduleForPath("/api/receivables")).toBe("financial.receivables");
    expect(moduleForPath("/api/financial/overview")).toBe("financial.overview");
    expect(moduleForPath("/api/areas")).toBe("areas");
  });

  it("maps nested routes under a module prefix", () => {
    expect(moduleForPath("/api/tasks/abc-123")).toBe("tasks");
    expect(moduleForPath("/api/tasks/upcoming")).toBe("tasks");
    expect(moduleForPath("/api/projects/p1/tasks")).toBe("projects");
    expect(moduleForPath("/api/calendar/events")).toBe("calendar");
    expect(moduleForPath("/api/contracts/c1")).toBe("financial.contracts");
    expect(moduleForPath("/api/areas/a1")).toBe("areas");
  });

  it("returns null for unmapped paths", () => {
    expect(moduleForPath("/api/me")).toBeNull();
    expect(moduleForPath("/api/me/permissions")).toBeNull();
    expect(moduleForPath("/api/financial/exports/contracts")).toBeNull();
    expect(moduleForPath("/api/workspace")).toBeNull();
    expect(moduleForPath("/")).toBeNull();
  });
});

describe("resourceForOp", () => {
  it("maps write operations to a limit resource", () => {
    expect(resourceForOp("/api/tasks", "POST")).toBe("tasks");
    expect(resourceForOp("/api/projects", "POST")).toBe("projects");
    expect(resourceForOp("/api/documents", "POST")).toBe("documents");
    expect(resourceForOp("/api/calendar/events", "POST")).toBe("calendarEvents");
    expect(resourceForOp("/api/contracts", "POST")).toBe("contracts");
    expect(resourceForOp("/api/clients", "POST")).toBe("clients");
    expect(resourceForOp("/api/proposals", "POST")).toBe("proposals");
  });

  it("returns null for read operations", () => {
    expect(resourceForOp("/api/tasks", "GET")).toBeNull();
    expect(resourceForOp("/api/projects", "GET")).toBeNull();
    expect(resourceForOp("/api/receivables", "GET")).toBeNull();
    expect(resourceForOp("/api/financial/overview", "GET")).toBeNull();
  });

  it("returns null for modules without a configured resource", () => {
    expect(resourceForOp("/api/receivables", "POST")).toBeNull();
    expect(resourceForOp("/api/areas", "POST")).toBeNull();
    expect(resourceForOp("/api/financial/overview", "POST")).toBeNull();
  });

  it("returns null for unmapped paths", () => {
    expect(resourceForOp("/api/me", "POST")).toBeNull();
  });
});

describe("enforceFeatureGate", () => {
  it("allows when the module is enabled", async () => {
    mocks.mockCheckFeature.mockResolvedValue(true);

    const decision = await enforceFeatureGate({
      userId: "u1",
      pathname: "/api/tasks",
      method: "GET",
      tenantContext: nonAdmin,
    });

    expect(decision).toEqual({ ok: true });
    expect(mocks.mockCheckFeature).toHaveBeenCalledWith("ws_1", "tasks");
  });

  it("blocks with 403 when the module is not available in the plan", async () => {
    mocks.mockCheckFeature.mockResolvedValue(false);

    const decision = await enforceFeatureGate({
      userId: "u1",
      pathname: "/api/contracts",
      method: "GET",
      tenantContext: nonAdmin,
    });

    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.status).toBe(403);
      expect(decision.code).toBe(FEATURE_BLOCKED_CODE);
      expect(decision.error).toContain("Upgrade");
    }
  });

  it("blocks with 403 when a hard limit is reached", async () => {
    mocks.mockCheckFeature.mockResolvedValue(true);
    mocks.mockCheckLimit.mockResolvedValue({
      remaining: 0,
      limit: 5,
      behavior: "hard",
    });

    const decision = await enforceFeatureGate({
      userId: "u1",
      pathname: "/api/tasks",
      method: "POST",
      tenantContext: nonAdmin,
    });

    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.status).toBe(403);
      expect(decision.code).toBe(LIMIT_REACHED_CODE);
      expect(decision.error).toContain("Upgrade");
    }
    expect(mocks.mockCheckLimit).toHaveBeenCalledWith("ws_1", "tasks");
  });

  it("allows but returns a warning when a warning limit is near", async () => {
    mocks.mockCheckFeature.mockResolvedValue(true);
    mocks.mockCheckLimit.mockResolvedValue({
      remaining: 5,
      limit: 100,
      behavior: "warning",
    });

    const decision = await enforceFeatureGate({
      userId: "u1",
      pathname: "/api/tasks",
      method: "POST",
      tenantContext: nonAdmin,
    });

    expect(decision).toEqual({ ok: true, warning: "tasks:5" });
  });

  it("allows without a warning when a warning limit is not near", async () => {
    mocks.mockCheckFeature.mockResolvedValue(true);
    mocks.mockCheckLimit.mockResolvedValue({
      remaining: 90,
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

  it("warns when a warning limit is fully exhausted", async () => {
    mocks.mockCheckFeature.mockResolvedValue(true);
    mocks.mockCheckLimit.mockResolvedValue({
      remaining: 0,
      limit: 100,
      behavior: "warning",
    });

    const decision = await enforceFeatureGate({
      userId: "u1",
      pathname: "/api/tasks",
      method: "POST",
      tenantContext: nonAdmin,
    });

    expect(decision).toEqual({ ok: true, warning: "tasks:0" });
  });

  it("bypasses for workspace admins", async () => {
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

  it("bypasses for super-admins", async () => {
    mocks.mockGetSuperAdminStatus.mockResolvedValue(true);
    mocks.mockCheckFeature.mockResolvedValue(false);

    const decision = await enforceFeatureGate({
      userId: "u1",
      pathname: "/api/contracts",
      method: "GET",
      tenantContext: nonAdmin,
    });

    expect(decision).toEqual({ ok: true });
    expect(mocks.mockGetSuperAdminStatus).toHaveBeenCalledWith("u1");
    expect(mocks.mockCheckFeature).not.toHaveBeenCalled();
  });

  it("resolves the tenant context from the user when not provided", async () => {
    mocks.mockGetTenantContext.mockResolvedValue(nonAdmin);
    mocks.mockCheckFeature.mockResolvedValue(true);

    const decision = await enforceFeatureGate({
      userId: "u1",
      pathname: "/api/tasks",
      method: "GET",
    });

    expect(decision).toEqual({ ok: true });
    expect(mocks.mockGetTenantContext).toHaveBeenCalledWith("u1");
  });

  it("allows when there is no workspace", async () => {
    const decision = await enforceFeatureGate({
      userId: "u1",
      pathname: "/api/tasks",
      method: "GET",
      tenantContext: { ...nonAdmin, tenantId: null },
    });

    expect(decision).toEqual({ ok: true });
    expect(mocks.mockCheckFeature).not.toHaveBeenCalled();
  });

  it("allows unmapped paths without checking features", async () => {
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

describe("applyFeatureGate", () => {
  it("returns a 403 NextResponse for a blocked module", async () => {
    mocks.mockCheckFeature.mockResolvedValue(false);

    const result = await applyFeatureGate({
      userId: "u1",
      pathname: "/api/contracts",
      method: "GET",
      tenantContext: nonAdmin,
    });

    expect(result.response).not.toBeNull();
    expect(result.warning).toBeNull();
    expect(result.response!.status).toBe(403);
    const body = await result.response!.json();
    expect(body.error.code).toBe(FEATURE_BLOCKED_CODE);
  });

  it("returns a 403 NextResponse for a reached hard limit", async () => {
    mocks.mockCheckFeature.mockResolvedValue(true);
    mocks.mockCheckLimit.mockResolvedValue({
      remaining: 0,
      limit: 5,
      behavior: "hard",
    });

    const result = await applyFeatureGate({
      userId: "u1",
      pathname: "/api/projects",
      method: "POST",
      tenantContext: nonAdmin,
    });

    expect(result.response).not.toBeNull();
    expect(result.response!.status).toBe(403);
    const body = await result.response!.json();
    expect(body.error.code).toBe(LIMIT_REACHED_CODE);
  });

  it("allows with a warning value when a warning limit is near", async () => {
    mocks.mockCheckFeature.mockResolvedValue(true);
    mocks.mockCheckLimit.mockResolvedValue({
      remaining: 5,
      limit: 100,
      behavior: "warning",
    });

    const result = await applyFeatureGate({
      userId: "u1",
      pathname: "/api/tasks",
      method: "POST",
      tenantContext: nonAdmin,
    });

    expect(result.response).toBeNull();
    expect(result.warning).toBe("tasks:5");
  });

  it("allows without a warning when everything is fine", async () => {
    mocks.mockCheckFeature.mockResolvedValue(true);

    const result = await applyFeatureGate({
      userId: "u1",
      pathname: "/api/tasks",
      method: "GET",
      tenantContext: nonAdmin,
    });

    expect(result.response).toBeNull();
    expect(result.warning).toBeNull();
  });
});

describe("withFeatureWarning", () => {
  it("sets the warning header on the response", () => {
    const response = NextResponse.json({ data: null, error: null });
    const result = withFeatureWarning(response, "tasks:5");

    expect(result.headers.get(FEATURE_WARNING_HEADER)).toBe("tasks:5");
  });

  it("leaves the response untouched when there is no warning", () => {
    const response = NextResponse.json({ data: null, error: null });
    const result = withFeatureWarning(response, null);

    expect(result.headers.has(FEATURE_WARNING_HEADER)).toBe(false);
  });
});