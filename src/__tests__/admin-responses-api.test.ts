import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireClosedBetaAdmin: vi.fn(),
  listCheckinResponses: vi.fn(),
  getCheckinResponseDetail: vi.fn(),
  getCheckinResponseGrouping: vi.fn(),
  getCheckinEditionMetrics: vi.fn(),
  exportCheckinResponses: vi.fn(),
  grantCheckinExemption: vi.fn(),
  revokeCheckinExemption: vi.fn(),
  resetCheckinResponse: vi.fn(),
}));

vi.mock("@/lib/closed-beta/admin", () => ({
  requireClosedBetaAdmin: mocks.requireClosedBetaAdmin,
}));

vi.mock("@/lib/closed-beta/responses", () => ({
  listCheckinResponses: mocks.listCheckinResponses,
  getCheckinResponseDetail: mocks.getCheckinResponseDetail,
  getCheckinResponseGrouping: mocks.getCheckinResponseGrouping,
  getCheckinEditionMetrics: mocks.getCheckinEditionMetrics,
  exportCheckinResponses: mocks.exportCheckinResponses,
}));

vi.mock("@/lib/closed-beta/checkin", () => {
  class CheckinValidationError extends Error {}
  class CheckinNotFoundError extends Error {}
  class CheckinConflictError extends Error {}
  class CheckinEditionClosedError extends Error {}
  return {
    CheckinValidationError,
    CheckinNotFoundError,
    CheckinConflictError,
    CheckinEditionClosedError,
    grantCheckinExemption: mocks.grantCheckinExemption,
    revokeCheckinExemption: mocks.revokeCheckinExemption,
    resetCheckinResponse: mocks.resetCheckinResponse,
  };
});

import { GET as responses } from "../app/api/admin/closed-beta/checkins/[id]/responses/route";
import { POST as grant } from "../app/api/admin/closed-beta/checkins/[id]/exemptions/route";
import { POST as revoke } from "../app/api/admin/closed-beta/checkins/[id]/exemptions/revoke/route";
import { POST as reset } from "../app/api/admin/closed-beta/checkins/[id]/workspaces/[workspaceId]/reset/route";

function admin() {
  mocks.requireClosedBetaAdmin.mockResolvedValue({
    ok: true,
    user: { id: "admin-1", email: "admin@example.com" },
  });
}

function request(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  admin();
});

describe("admin responses API", () => {
  it("requires authentication", async () => {
    mocks.requireClosedBetaAdmin.mockResolvedValue({ ok: false, reason: "unauthorized" });
    expect((await responses(request("http://x/x", "GET"), { params: { id: "e1" } } as never)).status).toBe(401);
    expect(
      (await grant(request("http://x/x", "POST", { workspaceId: "w1", reason: "r", expiresAt: "2026-08-25T00:00:00Z" }), { params: { id: "e1" } } as never)).status,
    ).toBe(401);
    expect(
      (await reset(request("http://x/x", "POST"), { params: { id: "e1", workspaceId: "w1" } } as never)).status,
    ).toBe(401);
  });

  it("lists responses for an edition", async () => {
    mocks.listCheckinResponses.mockResolvedValue([{ id: "r1" }]);
    const res = await responses(request("http://x/x", "GET"), { params: { id: "e1" } } as never);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(mocks.listCheckinResponses).toHaveBeenCalledWith(
      expect.objectContaining({ editionId: "e1" }),
    );
  });

  it("returns grouped responses", async () => {
    mocks.getCheckinResponseGrouping.mockResolvedValue([{ questionId: "q1" }]);
    const res = await responses(
      request("http://x/x?mode=grouped", "GET"),
      { params: { id: "e1" } } as never,
    );
    expect((await res.json()).data).toHaveLength(1);
  });

  it("returns a response detail for a company", async () => {
    mocks.getCheckinResponseDetail.mockResolvedValue({ id: "r1", workspaceId: "w1" });
    const res = await responses(
      request("http://x/x?mode=detail&workspaceId=w1", "GET"),
      { params: { id: "e1" } } as never,
    );

    expect(res.status).toBe(200);
    expect((await res.json()).data.id).toBe("r1");
    expect(mocks.getCheckinResponseDetail).toHaveBeenCalledWith("e1", "w1");
  });

  it("returns metrics", async () => {
    mocks.getCheckinEditionMetrics.mockResolvedValue({ completionRate: 50 });
    const res = await responses(
      request("http://x/x?mode=metrics", "GET"),
      { params: { id: "e1" } } as never,
    );
    expect((await res.json()).data.completionRate).toBe(50);
  });

  it("exports responses", async () => {
    mocks.exportCheckinResponses.mockResolvedValue([{ answer: "5" }]);
    const res = await responses(
      request("http://x/x?mode=export", "GET"),
      { params: { id: "e1" } } as never,
    );
    expect((await res.json()).data).toHaveLength(1);
  });

  it("grants an exemption with reason and expiry", async () => {
    mocks.grantCheckinExemption.mockResolvedValue({ status: "exempt" });
    const res = await grant(
      request("http://x/x", "POST", {
        workspaceId: "w1",
        reason: "Suporte",
        expiresAt: "2026-08-25T00:00:00.000Z",
      }),
      { params: { id: "e1" } } as never,
    );
    expect(res.status).toBe(201);
    expect(mocks.grantCheckinExemption).toHaveBeenCalledWith(
      expect.objectContaining({
        editionId: "e1",
        workspaceId: "w1",
        reason: "Suporte",
        expiresAt: new Date("2026-08-25T00:00:00.000Z"),
      }),
    );
  });

  it("rejects an exemption without a reason", async () => {
    const res = await grant(
      request("http://x/x", "POST", { workspaceId: "w1", reason: "", expiresAt: "2026-08-25T00:00:00Z" }),
      { params: { id: "e1" } } as never,
    );
    expect(res.status).toBe(400);
    expect(mocks.grantCheckinExemption).not.toHaveBeenCalled();
  });

  it("revokes an exemption", async () => {
    mocks.revokeCheckinExemption.mockResolvedValue({ status: "pending" });
    const res = await revoke(
      request("http://x/x", "POST", { workspaceId: "w1" }),
      { params: { id: "e1" } } as never,
    );
    expect(res.status).toBe(200);
    expect(mocks.revokeCheckinExemption).toHaveBeenCalledWith(
      "e1",
      "w1",
      expect.objectContaining({ userId: "admin-1" }),
    );
  });

  it("resets a response", async () => {
    mocks.resetCheckinResponse.mockResolvedValue({ state: { status: "pending" }, preservedResponses: ["r1"] });
    const res = await reset(
      request("http://x/x", "POST"),
      { params: { id: "e1", workspaceId: "w1" } } as never,
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.preservedResponses).toEqual(["r1"]);
    expect(mocks.resetCheckinResponse).toHaveBeenCalledWith(
      "e1",
      "w1",
      expect.objectContaining({ userId: "admin-1" }),
    );
  });
});
