import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  consumeClosedBetaRateLimit: vi.fn(),
  getPrimaryInvitationByToken: vi.fn(),
  acceptPrimaryInvitation: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ getUser: mocks.getUser }));
vi.mock("@/lib/closed-beta/service", () => ({
  ClosedBetaCapacityError: class ClosedBetaCapacityError extends Error {},
  ClosedBetaEmailMismatchError: class ClosedBetaEmailMismatchError extends Error {},
  ClosedBetaExistingAccountError: class ClosedBetaExistingAccountError extends Error {},
  ClosedBetaInactiveError: class ClosedBetaInactiveError extends Error {},
  ClosedBetaInvitationError: class ClosedBetaInvitationError extends Error {},
  ClosedBetaTermsError: class ClosedBetaTermsError extends Error {},
  getPrimaryInvitationByToken: mocks.getPrimaryInvitationByToken,
  acceptPrimaryInvitation: mocks.acceptPrimaryInvitation,
  consumeClosedBetaRateLimit: mocks.consumeClosedBetaRateLimit,
}));

import { POST as accept } from "../app/api/closed-beta/accept/route";
import { GET as lookup } from "../app/api/closed-beta/invitations/[token]/route";

function request(body: unknown) {
  return new Request("http://localhost/api/closed-beta/accept", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Closed Beta primary acceptance API", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.getUser.mockResolvedValue({
      id: "user-1",
      email: "owner@example.com",
      email_confirmed_at: "2026-08-17T10:00:00.000Z",
      user_metadata: { full_name: "Owner" },
    });
    mocks.consumeClosedBetaRateLimit.mockResolvedValue(true);
    mocks.acceptPrimaryInvitation.mockResolvedValue({
      profile: { id: "user-1" },
      workspaceId: "workspace-1",
    });
  });

  it("does not reveal token validity to a public lookup", async () => {
    mocks.getPrimaryInvitationByToken.mockResolvedValue(null);

    const response = await lookup(new NextRequest("http://localhost/invite"), {
      params: { token: "invalid-token" },
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ status: "unavailable" });
  });

  it("requires authentication before accepting", async () => {
    mocks.getUser.mockResolvedValue(null);

    const response = await accept(request({ token: "token", consentVersion: "2026-08-17" }));

    expect(response.status).toBe(401);
    expect(mocks.acceptPrimaryInvitation).not.toHaveBeenCalled();
  });

  it("returns 429 when the acceptance limiter rejects the request", async () => {
    mocks.consumeClosedBetaRateLimit.mockResolvedValue(false);

    const response = await accept(request({ token: "token", consentVersion: "2026-08-17" }));

    expect(response.status).toBe(429);
    expect(mocks.acceptPrimaryInvitation).not.toHaveBeenCalled();
  });

  it("passes verified identity and terms consent to the domain seam", async () => {
    const response = await accept(
      request({ token: "token", consentVersion: "2026-08-17" }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.workspaceId).toBe("workspace-1");
    expect(mocks.acceptPrimaryInvitation).toHaveBeenCalledWith({
      token: "token",
      userId: "user-1",
      email: "owner@example.com",
      name: "Owner",
      emailConfirmedAt: "2026-08-17T10:00:00.000Z",
      consentVersion: "2026-08-17",
    });
  });

  it("returns a non-enumerating response for an invalid invitation", async () => {
    mocks.acceptPrimaryInvitation.mockRejectedValue(new Error("secret internal detail"));

    const response = await accept(
      request({ token: "token", consentVersion: "2026-08-17" }),
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error.message).not.toContain("secret internal detail");
  });
});
