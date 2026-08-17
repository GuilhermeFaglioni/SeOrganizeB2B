import { afterEach, describe, expect, it, vi } from "vitest";
import {
  disconnectGoogleCalendar,
  getValidAccessToken,
} from "../lib/google/oauth";
import {
  decryptGoogleToken,
  encryptGoogleToken,
} from "../lib/google/token-crypto";

const mocks = vi.hoisted(() => ({
  authFindUnique: vi.fn(),
  authUpdateMany: vi.fn(),
  authDelete: vi.fn(),
  calendarEventDeleteMany: vi.fn(),
}));

vi.mock("../../prisma/client", () => ({
  prisma: {
    calendarAuth: {
      findUnique: mocks.authFindUnique,
      updateMany: mocks.authUpdateMany,
      delete: mocks.authDelete,
    },
    calendarEvent: {
      deleteMany: mocks.calendarEventDeleteMany,
    },
  },
}));

const KEY = Buffer.alloc(32, 9).toString("base64");

describe("Google token lifecycle", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  });

  it("returns a decrypted access token while it is outside the refresh margin", async () => {
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = KEY;
    const encryptedAccessToken = encryptGoogleToken("access-token");
    mocks.authFindUnique.mockResolvedValue({
      connectionStatus: "connected",
      grantedScopes: "openid email https://www.googleapis.com/auth/calendar.events.owned",
      accessToken: encryptedAccessToken,
      refreshToken: encryptGoogleToken("refresh-token"),
      expiresAt: new Date(Date.now() + 120_000),
    });

    await expect(getValidAccessToken("user-1")).resolves.toBe("access-token");
    expect(mocks.authUpdateMany).not.toHaveBeenCalled();
  });

  it("refreshes with a lease and encrypts rotated credentials", async () => {
    process.env.GOOGLE_CLIENT_ID = "client-id";
    process.env.GOOGLE_CLIENT_SECRET = "client-secret";
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = KEY;
    const oldRefreshToken = encryptGoogleToken("old-refresh-token");
    mocks.authFindUnique.mockResolvedValue({
      connectionStatus: "connected",
      grantedScopes: "openid email https://www.googleapis.com/auth/calendar.events.owned",
      accessToken: encryptGoogleToken("expired-access-token"),
      refreshToken: oldRefreshToken,
      expiresAt: new Date(Date.now() - 1_000),
    });
    mocks.authUpdateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            access_token: "new-access-token",
            refresh_token: "new-refresh-token",
            expires_in: 3600,
          }),
          { status: 200 },
        ),
      ),
    );

    await expect(getValidAccessToken("user-1")).resolves.toBe("new-access-token");

    const finalUpdate = mocks.authUpdateMany.mock.calls[1][0];
    expect(decryptGoogleToken(finalUpdate.data.accessToken)).toBe(
      "new-access-token",
    );
    expect(decryptGoogleToken(finalUpdate.data.refreshToken)).toBe(
      "new-refresh-token",
    );
    expect(finalUpdate.data.refreshLeaseUntil).toBeNull();
  });

  it("marks the connection for reconnection when Google returns invalid_grant", async () => {
    process.env.GOOGLE_CLIENT_ID = "client-id";
    process.env.GOOGLE_CLIENT_SECRET = "client-secret";
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = KEY;
    mocks.authFindUnique.mockResolvedValue({
      connectionStatus: "connected",
      grantedScopes: "openid email https://www.googleapis.com/auth/calendar.events.owned",
      accessToken: encryptGoogleToken("expired-access-token"),
      refreshToken: encryptGoogleToken("refresh-token"),
      expiresAt: new Date(Date.now() - 1_000),
    });
    mocks.authUpdateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 }),
      ),
    );

    await expect(getValidAccessToken("user-1")).rejects.toMatchObject({
      code: "GOOGLE_AUTH_RECONNECT_REQUIRED",
    });
    expect(mocks.authUpdateMany.mock.calls[1][0].data).toEqual(
      expect.objectContaining({
        accessToken: null,
        refreshToken: null,
        connectionStatus: "reconnect_required",
      }),
    );
  });

  it("requires reconnection before using a connection without an approved scope set", async () => {
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = KEY;
    mocks.authFindUnique.mockResolvedValue({
      connectionStatus: "connected",
      grantedScopes: null,
      accessToken: encryptGoogleToken("access-token"),
      refreshToken: encryptGoogleToken("refresh-token"),
      expiresAt: new Date(Date.now() + 120_000),
    });
    mocks.authUpdateMany.mockResolvedValue({ count: 1 });

    await expect(getValidAccessToken("user-1")).rejects.toMatchObject({
      code: "GOOGLE_AUTH_RECONNECT_REQUIRED",
    });
    expect(mocks.authUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          connectionStatus: "reconnect_required",
          lastErrorCode: "GOOGLE_SCOPE_MIGRATION_REQUIRED",
        }),
      }),
    );
  });

  it("revokes the refresh token before deleting the local connection", async () => {
    process.env.GOOGLE_CLIENT_ID = "client-id";
    process.env.GOOGLE_CLIENT_SECRET = "client-secret";
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = KEY;
    mocks.authFindUnique.mockResolvedValue({
      tenantId: "tenant-1",
      refreshToken: encryptGoogleToken("refresh-token"),
      accessToken: encryptGoogleToken("access-token"),
    });
    mocks.authDelete.mockResolvedValue({ id: "auth-1" });
    mocks.calendarEventDeleteMany.mockResolvedValue({ count: 1 });
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(disconnectGoogleCalendar("user-1")).resolves.toEqual({
      revocationFailed: false,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://oauth2.googleapis.com/revoke",
      expect.objectContaining({ body: expect.any(URLSearchParams) }),
    );
    const body = fetchMock.mock.calls[0][1].body as URLSearchParams;
    expect(body.get("token")).toBe("refresh-token");
    expect(mocks.authDelete).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    expect(mocks.calendarEventDeleteMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        tenantId: "tenant-1",
        OR: [{ source: "google" }, { googleId: { not: null } }],
      },
    });
  });
});
