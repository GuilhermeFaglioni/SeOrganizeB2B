import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getSuperAdminStatus: vi.fn(),
  getClosedBetaConfig: vi.fn(),
  getClosedBetaMetrics: vi.fn(),
  updateClosedBetaConfig: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ getUser: mocks.getUser }));
vi.mock("@/lib/admin/super-admin", () => ({
  getSuperAdminStatus: mocks.getSuperAdminStatus,
}));
vi.mock("@/lib/closed-beta/service", () => ({
  ClosedBetaValidationError: class ClosedBetaValidationError extends Error {},
  getClosedBetaConfig: mocks.getClosedBetaConfig,
  getClosedBetaMetrics: mocks.getClosedBetaMetrics,
  updateClosedBetaConfig: mocks.updateClosedBetaConfig,
}));

import { GET, PATCH } from "../app/api/admin/closed-beta/route";

const config = {
  id: "default",
  status: "paused",
  maxPrimaryWorkspaces: 30,
  maxGuestsPerWorkspace: 3,
  planId: "plan-beta",
  plan: {
    id: "plan-beta",
    name: "Closed Beta",
    isInternal: true,
    isActive: true,
    allowedModules: ["tasks", "financial.contracts"],
  },
};

const metrics = {
  maxPrimaryWorkspaces: 30,
  activePrimaryWorkspaces: 2,
  reservedPrimaryWorkspaces: 1,
  availablePrimaryWorkspaces: 27,
};

const request = (body: unknown) =>
  new NextRequest("http://localhost/api/admin/closed-beta", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("admin Closed Beta API", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.getClosedBetaConfig.mockResolvedValue(config);
    mocks.getClosedBetaMetrics.mockResolvedValue(metrics);
    mocks.updateClosedBetaConfig.mockResolvedValue(config);
  });

  it("requires authentication", async () => {
    mocks.getUser.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(mocks.getClosedBetaConfig).not.toHaveBeenCalled();
  });

  it("requires the existing super-admin authorization", async () => {
    mocks.getUser.mockResolvedValue({ id: "user-1", email: "user@example.com" });
    mocks.getSuperAdminStatus.mockResolvedValue(false);

    const response = await PATCH(request({ status: "active" }));

    expect(response.status).toBe(403);
    expect(mocks.updateClosedBetaConfig).not.toHaveBeenCalled();
  });

  it("returns configuration and capacity metrics to a super-admin", async () => {
    mocks.getUser.mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
    mocks.getSuperAdminStatus.mockResolvedValue(true);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ config, metrics });
  });

  it("updates global status and limits with the acting admin", async () => {
    mocks.getUser.mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
    mocks.getSuperAdminStatus.mockResolvedValue(true);

    const response = await PATCH(
      request({ status: "active", maxPrimaryWorkspaces: 40, maxGuestsPerWorkspace: 4 }),
    );

    expect(response.status).toBe(200);
    expect(mocks.updateClosedBetaConfig).toHaveBeenCalledWith(
      { status: "active", maxPrimaryWorkspaces: 40, maxGuestsPerWorkspace: 4 },
      { userId: "admin-1", email: "admin@example.com" },
    );
  });

  it("rejects non-integer limits before reaching the domain service", async () => {
    mocks.getUser.mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
    mocks.getSuperAdminStatus.mockResolvedValue(true);

    const response = await PATCH(request({ maxPrimaryWorkspaces: 1.5 }));

    expect(response.status).toBe(400);
    expect(mocks.updateClosedBetaConfig).not.toHaveBeenCalled();
  });
});
