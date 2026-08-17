import { createHash, randomBytes } from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../../../prisma/client";
import {
  decryptGoogleToken,
  encryptGoogleToken,
  GoogleTokenCryptoError,
} from "./token-crypto";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_CALENDAR_SCOPE =
  "https://www.googleapis.com/auth/calendar.events.owned";
export const GOOGLE_SCOPES = ["openid", "email", GOOGLE_CALENDAR_SCOPE] as const;

export interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
  token_type?: string;
}

export interface GoogleIdentity {
  subject: string;
  email: string | null;
}

export interface OAuthAttemptSecrets {
  state: string;
  stateHash: string;
  codeVerifier: string;
  codeChallenge: string;
  nonce: string;
  nonceHash: string;
}

type GoogleAuthErrorCode =
  | "GOOGLE_AUTH_REQUIRED"
  | "GOOGLE_AUTH_EXPIRED"
  | "GOOGLE_AUTH_RECONNECT_REQUIRED"
  | "GOOGLE_AUTH_INVALID_REQUEST"
  | "GOOGLE_AUTH_CONFIGURATION";

export class GoogleAuthError extends Error {
  readonly code: GoogleAuthErrorCode;

  constructor(code: GoogleAuthErrorCode, message: string) {
    super(message);
    this.name = "GoogleAuthError";
    this.code = code;
  }
}

function requiredGoogleClientId(): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new GoogleAuthError(
      "GOOGLE_AUTH_CONFIGURATION",
      "Google OAuth is not configured",
    );
  }
  return clientId;
}

function requiredGoogleClientSecret(): string {
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientSecret) {
    throw new GoogleAuthError(
      "GOOGLE_AUTH_CONFIGURATION",
      "Google OAuth client secret is not configured",
    );
  }
  return clientSecret;
}

export function getAppOrigin(requestOrigin?: string): string {
  const configuredOrigin =
    process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? null;
  if (!configuredOrigin) {
    if (process.env.NODE_ENV === "production") {
      throw new GoogleAuthError(
        "GOOGLE_AUTH_CONFIGURATION",
        "The application URL is not configured",
      );
    }
    return requestOrigin ?? "http://localhost:3000";
  }

  let url: URL;
  try {
    url = new URL(configuredOrigin);
  } catch {
    throw new GoogleAuthError(
      "GOOGLE_AUTH_CONFIGURATION",
      "The application URL is invalid",
    );
  }
  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    throw new GoogleAuthError(
      "GOOGLE_AUTH_CONFIGURATION",
      "The application URL must use HTTPS",
    );
  }
  return url.origin;
}

export function getCalendarRedirectUri(requestOrigin?: string): string {
  return `${getAppOrigin(requestOrigin)}/api/calendar/auth/callback`;
}

function base64UrlSha256(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

export function hashOAuthValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function createOAuthAttemptSecrets(): OAuthAttemptSecrets {
  const state = randomBytes(32).toString("base64url");
  const codeVerifier = randomBytes(32).toString("base64url");
  const nonce = randomBytes(32).toString("base64url");
  return {
    state,
    stateHash: hashOAuthValue(state),
    codeVerifier,
    codeChallenge: base64UrlSha256(codeVerifier),
    nonce,
    nonceHash: hashOAuthValue(nonce),
  };
}

export function getAuthUrl({
  redirectUri,
  state,
  codeChallenge,
  nonce,
}: {
  redirectUri: string;
  state: string;
  codeChallenge: string;
  nonce: string;
}): string {
  const params = new URLSearchParams({
    client_id: requiredGoogleClientId(),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCode(
  code: string,
  redirectUri: string,
  codeVerifier: string,
): Promise<GoogleTokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: requiredGoogleClientId(),
      client_secret: requiredGoogleClientSecret(),
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
    }),
  });

  if (!res.ok) {
    throw new GoogleAuthError(
      "GOOGLE_AUTH_INVALID_REQUEST",
      "Google authorization code exchange failed",
    );
  }

  return (await res.json()) as GoogleTokenResponse;
}

export async function refreshAccessToken(refreshToken: string) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requiredGoogleClientId(),
      client_secret: requiredGoogleClientSecret(),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const body = (await res.json().catch(() => ({}))) as {
    error?: string;
  } & GoogleTokenResponse;
  if (!res.ok) {
    if (body.error === "invalid_grant") {
      throw new GoogleAuthError(
        "GOOGLE_AUTH_RECONNECT_REQUIRED",
        "Google authorization was revoked. Reconnect your calendar.",
      );
    }
    throw new GoogleAuthError(
      "GOOGLE_AUTH_EXPIRED",
      "Google authorization expired. Reconnect your calendar.",
    );
  }

  return body;
}

export async function verifyGoogleIdToken(
  idToken: string,
  expectedNonceHash: string,
): Promise<GoogleIdentity> {
  const clientId = requiredGoogleClientId();
  const client = new OAuth2Client(clientId);
  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: clientId,
    });
    const payload = ticket.getPayload();
    if (
      !payload?.sub ||
      !payload.nonce ||
      hashOAuthValue(payload.nonce) !== expectedNonceHash ||
      payload.email_verified !== true
    ) {
      throw new Error("Google identity claims are incomplete");
    }
    return {
      subject: payload.sub,
      email: payload.email ?? null,
    };
  } catch {
    throw new GoogleAuthError(
      "GOOGLE_AUTH_INVALID_REQUEST",
      "Google identity validation failed",
    );
  }
}

const REFRESH_SKEW_MS = 60_000;
const REFRESH_LEASE_MS = 30_000;
const REFRESH_WAIT_MS = 75;
const MAX_REFRESH_ATTEMPTS = 5;

function decryptStoredToken(value: string | null | undefined): string {
  try {
    return decryptGoogleToken(value);
  } catch (error) {
    if (error instanceof GoogleTokenCryptoError) {
      throw new GoogleAuthError(
        "GOOGLE_AUTH_CONFIGURATION",
        "Google token storage requires migration or configuration",
      );
    }
    throw error;
  }
}

function waitForRefresh(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, REFRESH_WAIT_MS));
}

export async function markCalendarReconnectRequired(
  userId: string,
  errorCode = "GOOGLE_AUTH_RECONNECT_REQUIRED",
): Promise<void> {
  await prisma.calendarAuth.updateMany({
    where: { userId },
    data: {
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      connectionStatus: "reconnect_required",
      revokedAt: new Date(),
      lastErrorCode: errorCode,
      refreshLeaseUntil: null,
    },
  });
}

export async function getValidAccessToken(userId: string): Promise<string> {
  for (let attemptNumber = 0; attemptNumber < MAX_REFRESH_ATTEMPTS; attemptNumber += 1) {
    const auth = await prisma.calendarAuth.findUnique({ where: { userId } });
    if (!auth || auth.connectionStatus !== "connected") {
      throw new GoogleAuthError(
        auth ? "GOOGLE_AUTH_RECONNECT_REQUIRED" : "GOOGLE_AUTH_REQUIRED",
        auth
          ? "Google authorization must be reconnected"
          : "Google Calendar is not connected",
      );
    }

    const now = Date.now();
    if (
      auth.accessToken &&
      auth.expiresAt &&
      auth.expiresAt.getTime() > now + REFRESH_SKEW_MS
    ) {
      return decryptStoredToken(auth.accessToken);
    }

    if (!auth.refreshToken) {
      await markCalendarReconnectRequired(userId, "GOOGLE_AUTH_EXPIRED");
      throw new GoogleAuthError(
        "GOOGLE_AUTH_RECONNECT_REQUIRED",
        "Google authorization must be reconnected",
      );
    }

    const leaseUntil = new Date(now + REFRESH_LEASE_MS);
    const lease = await prisma.calendarAuth.updateMany({
      where: {
        userId,
        connectionStatus: "connected",
        OR: [
          { refreshLeaseUntil: null },
          { refreshLeaseUntil: { lt: new Date(now) } },
        ],
      },
      data: { refreshLeaseUntil: leaseUntil },
    });
    if (lease.count !== 1) {
      await waitForRefresh();
      continue;
    }

    try {
      const tokenData = await refreshAccessToken(
        decryptStoredToken(auth.refreshToken),
      );
      if (!tokenData.access_token || !tokenData.expires_in) {
        throw new GoogleAuthError(
          "GOOGLE_AUTH_EXPIRED",
          "Google did not return a valid access token",
        );
      }

      await prisma.calendarAuth.updateMany({
        where: { userId, refreshLeaseUntil: leaseUntil },
        data: {
          accessToken: encryptGoogleToken(tokenData.access_token),
          refreshToken: tokenData.refresh_token
            ? encryptGoogleToken(tokenData.refresh_token)
            : auth.refreshToken,
          expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
          connectionStatus: "connected",
          revokedAt: null,
          lastErrorCode: null,
          refreshLeaseUntil: null,
        },
      });
      return tokenData.access_token;
    } catch (error) {
      if (error instanceof GoogleAuthError && error.code === "GOOGLE_AUTH_RECONNECT_REQUIRED") {
        await markCalendarReconnectRequired(userId, error.code);
      } else {
        await prisma.calendarAuth.updateMany({
          where: { userId, refreshLeaseUntil: leaseUntil },
          data: { refreshLeaseUntil: null },
        });
      }
      throw error;
    }
  }

  throw new GoogleAuthError(
    "GOOGLE_AUTH_EXPIRED",
    "Google Calendar refresh is still in progress. Try again.",
  );
}

export async function revokeGoogleToken(token: string): Promise<void> {
  const response = await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
  });
  if (!response.ok && response.status !== 400) {
    throw new Error("Google token revocation failed");
  }
}

export async function disconnectGoogleCalendar(
  userId: string,
): Promise<{ revocationFailed: boolean }> {
  const auth = await prisma.calendarAuth.findUnique({ where: { userId } });
  if (!auth) return { revocationFailed: false };

  let revocationFailed = false;
  const encryptedToken = auth.refreshToken ?? auth.accessToken;
  if (encryptedToken) {
    try {
      await revokeGoogleToken(decryptStoredToken(encryptedToken));
    } catch (error) {
      revocationFailed = true;
      console.error(
        "Google Calendar token revocation failed",
        error instanceof GoogleAuthError ? error.code : "GOOGLE_REVOCATION_FAILED",
      );
    }
  }

  await prisma.calendarAuth.delete({ where: { userId } });
  return { revocationFailed };
}
