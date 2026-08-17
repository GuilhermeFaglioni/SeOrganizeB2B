import { NextRequest, NextResponse } from "next/server";
import { prisma, withTenant } from "../../../../../../prisma/client";
import { getUser } from "@/lib/supabase/server";
import {
  exchangeCode,
  getAppOrigin,
  getCalendarRedirectUri,
  GOOGLE_CALENDAR_SCOPE,
  GoogleAuthError,
  hashOAuthValue,
  verifyGoogleIdToken,
} from "@/lib/google/oauth";
import { getTenantContext } from "@/lib/authz/tenant-context";
import { denyFor } from "@/lib/authz/authz";
import { applyFeatureGate } from "@/lib/middleware/feature-gating";

function redirectToCalendar(
  request: NextRequest,
  params: Record<string, string>,
): NextResponse {
  const origin = getSafeRedirectOrigin(request);
  const target = new URL("/calendar", origin);
  for (const [key, value] of Object.entries(params)) {
    target.searchParams.set(key, value);
  }
  return NextResponse.redirect(target);
}

function getSafeRedirectOrigin(request: NextRequest): string {
  const requestOrigin = new URL(request.url).origin;
  try {
    return getAppOrigin(requestOrigin);
  } catch {
    // Keep error redirects functional even when production configuration is broken.
    return requestOrigin;
  }
}

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.redirect(
      new URL("/login", getSafeRedirectOrigin(request)),
    );
  }

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) {
    return redirectToCalendar(request, { calendarAuth: "failed", error: "no_workspace" });
  }

  const denied = await denyFor(user.id, "calendar.edit");
  if (denied) {
    return redirectToCalendar(request, { calendarAuth: "failed", error: "forbidden" });
  }

  const gate = await applyFeatureGate({
    userId: user.id,
    pathname: "/api/calendar/auth/callback",
    method: "GET",
    tenantContext: ctx,
  });
  if (gate.response) {
    return redirectToCalendar(request, { calendarAuth: "failed", error: "feature_unavailable" });
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  if (oauthError) {
    if (state) {
      await withTenant(ctx.tenantId, () =>
        prisma.calendarOAuthAttempt.updateMany({
          where: {
            stateHash: hashOAuthValue(state),
            userId: user.id,
            consumedAt: null,
          },
          data: { consumedAt: new Date() },
        }),
      );
    }
    return redirectToCalendar(request, {
      calendarAuth: "failed",
      error: oauthError === "access_denied" ? "access_denied" : "oauth_failed",
    });
  }

  if (!code || !state) {
    return redirectToCalendar(request, {
      calendarAuth: "failed",
      error: "invalid_request",
    });
  }

  const stateHash = hashOAuthValue(state);
  const now = new Date();
  const attempt = await withTenant(ctx.tenantId, () =>
    prisma.calendarOAuthAttempt.findFirst({
      where: {
        stateHash,
        userId: user.id,
        consumedAt: null,
        expiresAt: { gt: now },
      },
    }),
  );

  if (!attempt) {
    return redirectToCalendar(request, {
      calendarAuth: "failed",
      error: "invalid_state",
    });
  }

  const claimed = await withTenant(ctx.tenantId, () =>
    prisma.calendarOAuthAttempt.updateMany({
      where: {
        id: attempt.id,
        stateHash,
        userId: user.id,
        consumedAt: null,
        expiresAt: { gt: now },
      },
      data: { consumedAt: now },
    }),
  );

  if (claimed.count !== 1) {
    return redirectToCalendar(request, {
      calendarAuth: "failed",
      error: "invalid_state",
    });
  }

  try {
    const redirectUri = getCalendarRedirectUri(new URL(request.url).origin);
    const tokenData = await exchangeCode(code, redirectUri, attempt.codeVerifier);
    const accessToken = tokenData.access_token;
    const expiresIn = tokenData.expires_in;
    if (
      !accessToken ||
      !tokenData.id_token ||
      typeof expiresIn !== "number" ||
      !Number.isFinite(expiresIn) ||
      !tokenData.scope?.split(/\s+/).includes(GOOGLE_CALENDAR_SCOPE)
    ) {
      throw new GoogleAuthError(
        "GOOGLE_AUTH_INVALID_REQUEST",
        "Google did not grant the required Calendar scope",
      );
    }

    const identity = await verifyGoogleIdToken(
      tokenData.id_token,
      attempt.nonceHash,
    );

    await withTenant(ctx.tenantId, async () =>
      prisma.$transaction(async (tx) => {
        const existing = await tx.calendarAuth.findUnique({
          where: { userId: user.id },
          select: { refreshToken: true },
        });
        const conflictingAuth = await tx.calendarAuth.findFirst({
          where: {
            googleSubject: identity.subject,
            userId: { not: user.id },
          },
          select: { id: true },
        });
        if (conflictingAuth) {
          throw new GoogleAuthError(
            "GOOGLE_AUTH_INVALID_REQUEST",
            "Google account is already connected",
          );
        }
        const refreshToken = tokenData.refresh_token ?? existing?.refreshToken;
        if (!refreshToken) {
          throw new GoogleAuthError(
            "GOOGLE_AUTH_INVALID_REQUEST",
            "Google did not return a refresh token",
          );
        }

        return tx.calendarAuth.upsert({
          where: { userId: user.id },
          update: {
            googleSubject: identity.subject,
            accessToken,
            refreshToken,
            expiresAt: new Date(Date.now() + expiresIn * 1000),
            googleEmail: identity.email,
          },
          create: {
            userId: user.id,
            googleSubject: identity.subject,
            accessToken,
            refreshToken,
            expiresAt: new Date(Date.now() + expiresIn * 1000),
            googleEmail: identity.email,
            tenantId: ctx.tenantId!,
          },
        });
      }),
    );

    return redirectToCalendar(request, { calendarAuth: "connected" });
  } catch (error) {
    const reason =
      error instanceof GoogleAuthError ? error.code : "oauth_failed";
    console.error("Google Calendar authorization failed", reason);
    return redirectToCalendar(request, {
      calendarAuth: "failed",
      error: reason,
    });
  }
}
