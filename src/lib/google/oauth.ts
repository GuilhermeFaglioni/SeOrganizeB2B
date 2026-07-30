import { prisma } from "../../../prisma/client";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

export class GoogleAuthError extends Error {
  readonly code: "GOOGLE_AUTH_REQUIRED" | "GOOGLE_AUTH_EXPIRED";

  constructor(
    code: "GOOGLE_AUTH_REQUIRED" | "GOOGLE_AUTH_EXPIRED",
    message: string,
  ) {
    super(message);
    this.name = "GoogleAuthError";
    this.code = code;
  }
}

export function getAuthUrl(redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email https://www.googleapis.com/auth/calendar",
    access_type: "offline",
    prompt: "consent",
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCode(code: string, redirectUri: string) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    throw new Error("Failed to exchange authorization code");
  }

  return res.json();
}

export async function refreshAccessToken(refreshToken: string) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
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

  return res.json();
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

  await prisma.calendarAuth.update({
    where: { userId },
    data: {
      accessToken: tokenData.access_token,
      expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
    },
  });

  return tokenData.access_token;
}
