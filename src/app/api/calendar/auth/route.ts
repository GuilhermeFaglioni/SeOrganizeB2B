import { NextRequest, NextResponse } from "next/server";
import { prisma, withTenant } from "../../../../../prisma/client";
import { getUser } from "@/lib/supabase/server";
import {
  createOAuthAttemptSecrets,
  disconnectGoogleCalendar,
  getAuthUrl,
  getCalendarRedirectUri,
  GoogleAuthError,
} from "@/lib/google/oauth";
import { denyFor } from "@/lib/authz/authz";
import { getTenantContext } from "@/lib/authz/tenant-context";
import { noWorkspaceResponse } from "@/lib/authz/http";
import { applyFeatureGate } from "@/lib/middleware/feature-gating";

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }
  const denied = await denyFor(user.id, "calendar.view");
  if (denied) return denied;

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

  const gate = await applyFeatureGate({
    userId: user.id,
    pathname: "/api/calendar/auth",
    method: "GET",
    tenantContext: ctx,
  });
  if (gate.response) return gate.response;

  const auth = await withTenant(ctx.tenantId, () =>
    prisma.calendarAuth.findUnique({
      where: { userId: user.id },
      select: {
        googleEmail: true,
        connectionStatus: true,
        grantedScopes: true,
      },
    })
  );

  return NextResponse.json({
    data: {
      connected: auth?.connectionStatus === "connected",
      status: auth?.connectionStatus ?? "disconnected",
      email: auth?.googleEmail || null,
      scopes: auth?.grantedScopes?.split(/\s+/).filter(Boolean) ?? [],
    },
    error: null,
  });
}

export async function DELETE() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }
  const denied = await denyFor(user.id, "calendar.edit");
  if (denied) return denied;

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

  const gate = await applyFeatureGate({
    userId: user.id,
    pathname: "/api/calendar/auth",
    method: "DELETE",
    tenantContext: ctx,
  });
  if (gate.response) return gate.response;

  const result = await withTenant(ctx.tenantId, () =>
    disconnectGoogleCalendar(user.id),
  );

  return NextResponse.json({
    data: { connected: false, status: "disconnected", revocationFailed: result.revocationFailed },
    error: null,
  });
}

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }

  const denied = await denyFor(user.id, "calendar.edit");
  if (denied) return denied;

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

  const gate = await applyFeatureGate({
    userId: user.id,
    pathname: "/api/calendar/auth",
    method: "POST",
    tenantContext: ctx,
  });
  if (gate.response) return gate.response;

  try {
    const secrets = createOAuthAttemptSecrets();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);
    const redirectUri = getCalendarRedirectUri(new URL(request.url).origin);

    await withTenant(ctx.tenantId, async () => {
      await prisma.calendarOAuthAttempt.deleteMany({
        where: { userId: user.id, expiresAt: { lte: now } },
      });
      await prisma.calendarOAuthAttempt.create({
        data: {
          stateHash: secrets.stateHash,
          codeVerifier: secrets.codeVerifier,
          nonceHash: secrets.nonceHash,
          userId: user.id,
          tenantId: ctx.tenantId!,
          expiresAt,
        },
      });
    });

    const authUrl = getAuthUrl({
      redirectUri,
      state: secrets.state,
      codeChallenge: secrets.codeChallenge,
      nonce: secrets.nonce,
    });

    return NextResponse.json({ data: { url: authUrl }, error: null });
  } catch (error) {
    const code =
      error instanceof GoogleAuthError
        ? error.code
        : "GOOGLE_AUTH_CONFIGURATION";
    return NextResponse.json(
      {
        data: null,
        error: {
          code,
          message: "Google Calendar authorization is not available",
        },
      },
      { status: 503 },
    );
  }
}
