import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getTenantContext: vi.fn(),
  denyFor: vi.fn(),
  applyFeatureGate: vi.fn(),
  withTenant: vi.fn(),
  attemptDeleteMany: vi.fn(),
  attemptCreate: vi.fn(),
  attemptFindFirst: vi.fn(),
  attemptUpdateMany: vi.fn(),
  calendarAuthFindUnique: vi.fn(),
  calendarAuthFindFirst: vi.fn(),
  calendarAuthUpsert: vi.fn(),
  transaction: vi.fn(),
  createOAuthAttemptSecrets: vi.fn(),
  disconnectGoogleCalendar: vi.fn(),
  getAuthUrl: vi.fn(),
  getAppOrigin: vi.fn(),
  getCalendarRedirectUri: vi.fn(),
  exchangeCode: vi.fn(),
  validateGrantedScopes: vi.fn(),
  verifyGoogleIdToken: vi.fn(),
}));

const MockGoogleAuthError = vi.hoisted(
  () =>
    (class extends Error {
      code = "GOOGLE_AUTH_INVALID_REQUEST";
    }),
);

vi.mock("@/lib/supabase/server", () => ({
  getUser: mocks.getUser,
}));

vi.mock("@/lib/authz/tenant-context", () => ({
  getTenantContext: mocks.getTenantContext,
}));

vi.mock("@/lib/authz/authz", () => ({
  denyFor: mocks.denyFor,
}));

vi.mock("@/lib/middleware/feature-gating", () => ({
  applyFeatureGate: mocks.applyFeatureGate,
}));

vi.mock("@/lib/google/oauth", () => ({
  createOAuthAttemptSecrets: mocks.createOAuthAttemptSecrets,
  disconnectGoogleCalendar: mocks.disconnectGoogleCalendar,
  getAuthUrl: mocks.getAuthUrl,
  getAppOrigin: mocks.getAppOrigin,
  getCalendarRedirectUri: mocks.getCalendarRedirectUri,
  exchangeCode: mocks.exchangeCode,
  validateGrantedScopes: mocks.validateGrantedScopes,
  verifyGoogleIdToken: mocks.verifyGoogleIdToken,
  GOOGLE_CALENDAR_SCOPE: "https://www.googleapis.com/auth/calendar.events.owned",
  GoogleAuthError: MockGoogleAuthError,
  hashOAuthValue: (value: string) => `hash:${value}`,
}));

vi.mock("@/lib/google/token-crypto", () => ({
  encryptGoogleToken: (value: string) => `encrypted:${value}`,
}));

vi.mock("../../prisma/client", () => ({
  prisma: {
    calendarOAuthAttempt: {
      deleteMany: mocks.attemptDeleteMany,
      create: mocks.attemptCreate,
      findFirst: mocks.attemptFindFirst,
      updateMany: mocks.attemptUpdateMany,
    },
    calendarAuth: {
      findUnique: mocks.calendarAuthFindUnique,
      findFirst: mocks.calendarAuthFindFirst,
      upsert: mocks.calendarAuthUpsert,
    },
    $transaction: mocks.transaction,
  },
  withTenant: mocks.withTenant,
}));

import {
  DELETE as deleteAuth,
  GET as getAuthStatus,
  POST,
} from "../app/api/calendar/auth/route";
import { GET } from "../app/api/calendar/auth/callback/route";

const makeRequest = (path: string) =>
  new NextRequest(`http://localhost:3000${path}`);

describe("Google Calendar authorization routes", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.getUser.mockResolvedValue({ id: "user-1" });
    mocks.getTenantContext.mockResolvedValue({ tenantId: "tenant-1" });
    mocks.denyFor.mockResolvedValue(null);
    mocks.applyFeatureGate.mockResolvedValue({ response: null });
    mocks.withTenant.mockImplementation(
      async (_tenantId: string, callback: () => unknown) => callback(),
    );
    mocks.attemptDeleteMany.mockResolvedValue({ count: 0 });
    mocks.attemptCreate.mockResolvedValue({ id: "attempt-1" });
    mocks.attemptUpdateMany.mockResolvedValue({ count: 1 });
    mocks.createOAuthAttemptSecrets.mockReturnValue({
      state: "state-value",
      stateHash: "hash:state-value",
      codeVerifier: "code-verifier",
      codeChallenge: "code-challenge",
      nonce: "nonce-value",
      nonceHash: "hash:nonce-value",
    });
    mocks.getCalendarRedirectUri.mockReturnValue(
      "http://localhost:3000/api/calendar/auth/callback",
    );
    mocks.getAuthUrl.mockReturnValue("https://accounts.google.com/oauth");
    mocks.getAppOrigin.mockReturnValue("http://localhost:3000");
    mocks.attemptFindFirst.mockResolvedValue({
      id: "attempt-1",
      codeVerifier: "code-verifier",
      nonceHash: "hash:nonce-value",
    });
    mocks.exchangeCode.mockResolvedValue({
      access_token: "access-token",
      refresh_token: "refresh-token",
      id_token: "id-token",
      expires_in: 3600,
      scope: "openid email https://www.googleapis.com/auth/calendar.events.owned",
    });
    mocks.validateGrantedScopes.mockReturnValue([
      "openid",
      "email",
      "https://www.googleapis.com/auth/calendar.events.owned",
    ]);
    mocks.verifyGoogleIdToken.mockResolvedValue({
      subject: "google-subject",
      email: "user@example.com",
    });
    mocks.calendarAuthFindUnique.mockResolvedValue(null);
    mocks.calendarAuthFindFirst.mockResolvedValue(null);
    mocks.calendarAuthUpsert.mockResolvedValue({ id: "calendar-auth-1" });
    mocks.disconnectGoogleCalendar.mockResolvedValue({ revocationFailed: false });
    mocks.transaction.mockImplementation(
      async (callback: (tx: unknown) => unknown) =>
        callback({
          calendarAuth: {
            findUnique: mocks.calendarAuthFindUnique,
            findFirst: mocks.calendarAuthFindFirst,
            upsert: mocks.calendarAuthUpsert,
          },
        }),
    );
  });

  it("requires Calendar edit permission before creating an OAuth attempt", async () => {
    mocks.denyFor.mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), {
        status: 403,
      }),
    );

    const response = await POST(makeRequest("/api/calendar/auth"));

    expect(response.status).toBe(403);
    expect(mocks.attemptCreate).not.toHaveBeenCalled();
    expect(mocks.getAuthUrl).not.toHaveBeenCalled();
  });

  it("returns a reconnect-required connection without treating it as connected", async () => {
    mocks.calendarAuthFindUnique.mockResolvedValue({
      connectionStatus: "reconnect_required",
      googleEmail: "user@example.com",
      grantedScopes: "openid email https://www.googleapis.com/auth/calendar.events.owned",
    });

    const response = await getAuthStatus();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: {
        connected: false,
        status: "reconnect_required",
        email: "user@example.com",
        scopes: [
          "openid",
          "email",
          "https://www.googleapis.com/auth/calendar.events.owned",
        ],
      },
      error: null,
    });
  });

  it("revokes and removes the local connection through DELETE", async () => {
    const response = await deleteAuth();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: {
        connected: false,
        status: "disconnected",
        revocationFailed: false,
      },
      error: null,
    });
    expect(mocks.disconnectGoogleCalendar).toHaveBeenCalledWith("user-1");
  });

  it("stores a short-lived attempt and returns an authorization URL", async () => {
    const response = await POST(makeRequest("/api/calendar/auth"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: { url: "https://accounts.google.com/oauth" },
      error: null,
    });
    expect(mocks.attemptCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stateHash: "hash:state-value",
          codeVerifier: "code-verifier",
          nonceHash: "hash:nonce-value",
          userId: "user-1",
          tenantId: "tenant-1",
        }),
      }),
    );
    expect(mocks.getAuthUrl).toHaveBeenCalledWith({
      redirectUri: "http://localhost:3000/api/calendar/auth/callback",
      state: "state-value",
      codeChallenge: "code-challenge",
      nonce: "nonce-value",
    });
  });

  it("rejects a callback when its state is missing or expired", async () => {
    mocks.attemptFindFirst.mockResolvedValue(null);

    const response = await GET(
      makeRequest(
        "/api/calendar/auth/callback?code=authorization-code&state=stale-state",
      ),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(
      "error=invalid_state",
    );
    expect(mocks.exchangeCode).not.toHaveBeenCalled();
  });

  it("claims a valid state once and persists the verified Google identity", async () => {
    const response = await GET(
      makeRequest(
        "/api/calendar/auth/callback?code=authorization-code&state=state-value",
      ),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/calendar?calendarAuth=connected",
    );
    expect(mocks.attemptUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "attempt-1",
          stateHash: "hash:state-value",
          userId: "user-1",
          consumedAt: null,
        }),
        data: { consumedAt: expect.any(Date) },
      }),
    );
    expect(mocks.exchangeCode).toHaveBeenCalledWith(
      "authorization-code",
      "http://localhost:3000/api/calendar/auth/callback",
      "code-verifier",
    );
    expect(mocks.verifyGoogleIdToken).toHaveBeenCalledWith(
      "id-token",
      "hash:nonce-value",
    );
    expect(mocks.calendarAuthUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          googleSubject: "google-subject",
          googleEmail: "user@example.com",
        }),
        create: expect.objectContaining({
          userId: "user-1",
          tenantId: "tenant-1",
          googleSubject: "google-subject",
        }),
      }),
    );
  });

  it("does not exchange a code after Google returns access_denied", async () => {
    const response = await GET(
      makeRequest(
        "/api/calendar/auth/callback?error=access_denied&state=state-value",
      ),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(
      "error=access_denied",
    );
    expect(mocks.attemptUpdateMany).toHaveBeenCalledWith({
      where: {
        stateHash: "hash:state-value",
        userId: "user-1",
        consumedAt: null,
      },
      data: { consumedAt: expect.any(Date) },
    });
    expect(mocks.exchangeCode).not.toHaveBeenCalled();
  });

  it("does not reuse another Google identity's refresh token", async () => {
    mocks.exchangeCode.mockResolvedValue({
      access_token: "access-token",
      id_token: "id-token",
      expires_in: 3600,
      scope: "openid email https://www.googleapis.com/auth/calendar.events.owned",
    });
    mocks.calendarAuthFindUnique.mockResolvedValue({
      googleSubject: "old-google-subject",
      refreshToken: "encrypted:old-refresh-token",
    });

    const response = await GET(
      makeRequest(
        "/api/calendar/auth/callback?code=authorization-code&state=state-value",
      ),
    );

    expect(response.headers.get("location")).toContain(
      "error=GOOGLE_AUTH_INVALID_REQUEST",
    );
    expect(mocks.calendarAuthUpsert).not.toHaveBeenCalled();
  });
});
