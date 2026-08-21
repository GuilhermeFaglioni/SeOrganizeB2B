import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  denyFor: vi.fn(),
  getTenantContext: vi.fn(),
  getWorkspaceSettings: vi.fn(),
  updateWorkspaceSettings: vi.fn(),
  mapFinancialError: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ getUser: mocks.getUser }));
vi.mock("@/lib/authz/authz", () => ({ denyFor: mocks.denyFor }));
vi.mock("@/lib/authz/tenant-context", () => ({
  getTenantContext: mocks.getTenantContext,
}));
vi.mock("@/lib/financial/workspace-settings-service", () => ({
  getWorkspaceSettings: mocks.getWorkspaceSettings,
  updateWorkspaceSettings: mocks.updateWorkspaceSettings,
}));
vi.mock("@/lib/financial/http", () => ({
  mapFinancialError: mocks.mapFinancialError,
}));

import { PATCH } from "../app/api/settings/workspace/route";

const request = (body: unknown) =>
  new NextRequest("http://x/api/settings/workspace", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.getUser.mockResolvedValue({ id: "user-1", email: "owner@example.com" });
  mocks.getTenantContext.mockResolvedValue({
    tenantId: "workspace-1",
    isAdmin: true,
  });
  mocks.denyFor.mockResolvedValue(null);
  mocks.updateWorkspaceSettings.mockResolvedValue({
    id: "workspace-1",
    companyName: "Acme",
    logoUrl: null,
    pixKey: null,
    hasBindingCode: false,
  });
});

describe("PATCH /api/settings/workspace", () => {
  it("returns the check-in block before mutating settings", async () => {
    mocks.denyFor.mockResolvedValue(new Response(null, { status: 403 }));

    const response = await PATCH(request({ companyName: "Acme 2" }));

    expect(response.status).toBe(403);
    expect(mocks.denyFor).toHaveBeenCalledWith("user-1", "manage_roles");
    expect(mocks.updateWorkspaceSettings).not.toHaveBeenCalled();
  });

  it("updates settings for an allowed admin", async () => {
    const response = await PATCH(request({ companyName: "Acme 2" }));

    expect(response.status).toBe(200);
    expect(mocks.updateWorkspaceSettings).toHaveBeenCalledWith(
      { companyName: "Acme 2" },
      "workspace-1",
      { userId: "user-1", email: "owner@example.com" },
    );
  });
});
