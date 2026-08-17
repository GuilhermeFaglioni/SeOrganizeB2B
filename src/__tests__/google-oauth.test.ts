import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createOAuthAttemptSecrets,
  exchangeCode,
  getAuthUrl,
  hashOAuthValue,
  verifyGoogleIdToken,
} from "../lib/google/oauth";

const verifyIdToken = vi.hoisted(() => vi.fn());

vi.mock("google-auth-library", () => ({
  OAuth2Client: class {
    verifyIdToken = verifyIdToken;
  },
}));

describe("Google Calendar OAuth", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
  });

  it("creates independent state, PKCE and nonce secrets", () => {
    const first = createOAuthAttemptSecrets();
    const second = createOAuthAttemptSecrets();

    expect(first.state).not.toBe(second.state);
    expect(first.stateHash).toBe(hashOAuthValue(first.state));
    expect(first.nonceHash).toBe(hashOAuthValue(first.nonce));
    expect(first.codeChallenge).not.toBe(first.codeVerifier);
    expect(first.codeVerifier.length).toBeGreaterThanOrEqual(43);
  });

  it("includes state, PKCE, nonce and the least-privilege scope in the authorization URL", () => {
    process.env.GOOGLE_CLIENT_ID = "client-id";
    const url = new URL(
      getAuthUrl({
        redirectUri: "https://seorganize.faglionidev.com/api/calendar/auth/callback",
        state: "state-value",
        codeChallenge: "challenge-value",
        nonce: "nonce-value",
      }),
    );

    expect(url.searchParams.get("state")).toBe("state-value");
    expect(url.searchParams.get("code_challenge")).toBe("challenge-value");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("nonce")).toBe("nonce-value");
    expect(url.searchParams.get("scope")).toContain(
      "https://www.googleapis.com/auth/calendar.events.owned",
    );
    expect(url.searchParams.get("scope")?.split(" ")).not.toContain(
      "https://www.googleapis.com/auth/calendar",
    );
  });

  it("sends the PKCE verifier and exact redirect URI when exchanging a code", async () => {
    process.env.GOOGLE_CLIENT_ID = "client-id";
    process.env.GOOGLE_CLIENT_SECRET = "client-secret";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ access_token: "access" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await exchangeCode(
      "authorization-code",
      "https://seorganize.faglionidev.com/api/calendar/auth/callback",
      "code-verifier",
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://oauth2.googleapis.com/token",
      expect.objectContaining({
        body: expect.any(URLSearchParams),
      }),
    );
    const body = fetchMock.mock.calls[0][1].body as URLSearchParams;
    expect(body.get("code_verifier")).toBe("code-verifier");
    expect(body.get("redirect_uri")).toBe(
      "https://seorganize.faglionidev.com/api/calendar/auth/callback",
    );
  });

  it("accepts only a cryptographically verified identity with the expected nonce", async () => {
    process.env.GOOGLE_CLIENT_ID = "client-id";
    const nonce = "nonce-value";
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: "google-subject",
        email: "user@example.com",
        email_verified: true,
        nonce,
      }),
    });

    await expect(verifyGoogleIdToken("signed-id-token", hashOAuthValue(nonce))).resolves.toEqual({
      subject: "google-subject",
      email: "user@example.com",
    });

    verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: "google-subject",
        email: "user@example.com",
        email_verified: true,
        nonce: "different-nonce",
      }),
    });
    await expect(
      verifyGoogleIdToken("signed-id-token", hashOAuthValue(nonce)),
    ).rejects.toMatchObject({ code: "GOOGLE_AUTH_INVALID_REQUEST" });
  });
});
