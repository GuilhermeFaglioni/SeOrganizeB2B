import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => {
  class MockBindingCodeInvalidError extends Error {}
  class MockBindingCodeRateLimitError extends Error {
    retryAt = new Date("2026-08-14T12:00:00.000Z");
  }
  class MockInviteAlreadyMemberError extends Error {}
  class MockInviteNotFoundError extends Error {}
  class MockOnboardingRequiredError extends Error {
    state = { status: "binding_setup_required" as const };
  }

  return {
    mockGetUser: vi.fn(),
    mockGetOnboardingStatus: vi.fn(),
    mockBindUserToWorkspace: vi.fn(),
    MockBindingCodeInvalidError,
    MockBindingCodeRateLimitError,
    MockInviteAlreadyMemberError,
    MockInviteNotFoundError,
    MockOnboardingRequiredError,
  };
});

vi.mock("@/lib/supabase/server", () => ({
  getUser: mocks.mockGetUser,
}));

vi.mock("@/lib/invites/service", () => ({
  getOnboardingStatus: mocks.mockGetOnboardingStatus,
  bindUserToWorkspace: mocks.mockBindUserToWorkspace,
  BindingCodeInvalidError: mocks.MockBindingCodeInvalidError,
  BindingCodeRateLimitError: mocks.MockBindingCodeRateLimitError,
  InviteAlreadyMemberError: mocks.MockInviteAlreadyMemberError,
  InviteNotFoundError: mocks.MockInviteNotFoundError,
  OnboardingRequiredError: mocks.MockOnboardingRequiredError,
}));

import { GET as statusGET } from "../app/api/onboarding/status/route";
import { POST as bindPOST } from "../app/api/onboarding/bind/route";

describe("onboarding API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockGetUser.mockResolvedValue({
      id: "user-1",
      email: "User@Example.com",
      user_metadata: { full_name: "User" },
    });
  });

  it("returns the onboarding state for the authenticated user", async () => {
    mocks.mockGetOnboardingStatus.mockResolvedValue({
      status: "binding_required",
      reason: "pending_invite",
    });

    const res = await statusGET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      data: { status: "binding_required", reason: "pending_invite" },
      error: null,
    });
    expect(mocks.mockGetOnboardingStatus).toHaveBeenCalledWith({
      userId: "user-1",
      email: "User@Example.com",
    });
  });

  it("binds using only the session email and the submitted code", async () => {
    mocks.mockBindUserToWorkspace.mockResolvedValue({
      profile: { id: "user-1", tenantId: "workspace-1" },
    });
    const request = new NextRequest("http://x/api/onboarding/bind", {
      method: "POST",
      body: JSON.stringify({ bindingCode: "Acme-Join-2026" }),
      headers: { "content-type": "application/json" },
    });

    const res = await bindPOST(request);

    expect(res.status).toBe(200);
    expect(mocks.mockBindUserToWorkspace).toHaveBeenCalledWith({
      userId: "user-1",
      email: "User@Example.com",
      bindingCode: "Acme-Join-2026",
      name: "User",
    });
  });

  it("returns a generic error for an invalid code", async () => {
    mocks.mockBindUserToWorkspace.mockRejectedValue(
      new mocks.MockBindingCodeInvalidError(),
    );
    const request = new NextRequest("http://x/api/onboarding/bind", {
      method: "POST",
      body: JSON.stringify({ bindingCode: "Wrong-Code" }),
      headers: { "content-type": "application/json" },
    });

    const res = await bindPOST(request);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toEqual({
      code: "INVALID_BINDING_CODE",
      message: "The binding code could not be verified.",
    });
  });

  it("returns the retry time when the account is rate limited", async () => {
    mocks.mockBindUserToWorkspace.mockRejectedValue(
      new mocks.MockBindingCodeRateLimitError(),
    );
    const request = new NextRequest("http://x/api/onboarding/bind", {
      method: "POST",
      body: JSON.stringify({ bindingCode: "Wrong-Code" }),
      headers: { "content-type": "application/json" },
    });

    const res = await bindPOST(request);
    const json = await res.json();

    expect(res.status).toBe(429);
    expect(json.error.code).toBe("RATE_LIMITED");
    expect(json.data.retryAt).toBe("2026-08-14T12:00:00.000Z");
  });
});
