import { createHash, randomBytes } from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../../../prisma/client";

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

  if (!res.ok) {
    throw new GoogleAuthError(
      "GOOGLE_AUTH_EXPIRED",
      "Google authorization expired. Reconnect your calendar.",
    );
  }

  return (await res.json()) as GoogleTokenResponse;
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

export async function getValidAccessToken(userId: string): Promise<string> {
  const auth = await prisma.calendarAuth.findUnique({ where: { userId } });
  if (!auth) {
    throw new GoogleAuthError(
      "GOOGLE_AUTH_REQUIRED",
      "Google Calendar is not connected",
    );
  }

  if (auth.expiresAt > new Date()) {
    return auth.accessToken;
  }

  const tokenData = await refreshAccessToken(auth.refreshToken);
  if (!tokenData.access_token || !tokenData.expires_in) {
    throw new GoogleAuthError(
      "GOOGLE_AUTH_EXPIRED",
      "Google did not return a valid access token",
    );
  }

  await prisma.calendarAuth.update({
    where: { userId },
    data: {
      accessToken: tokenData.access_token,
      expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
    },
  });

  return tokenData.access_token;
}
