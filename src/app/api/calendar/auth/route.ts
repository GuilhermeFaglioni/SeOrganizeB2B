import { NextRequest, NextResponse } from "next/server";
import { prisma, withTenant } from "../../../../../prisma/client";
import { getUser } from "@/lib/supabase/server";
import { getAuthUrl } from "@/lib/google/oauth";
import { denyFor } from "@/lib/authz/authz";
import { getTenantContext } from "@/lib/authz/tenant-context";
import { noWorkspaceResponse } from "@/lib/authz/http";

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }
  const denied = await denyFor(user.id, "calendar.view");
  if (denied) return denied;

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

  const auth = await withTenant(ctx.tenantId, () =>
    prisma.calendarAuth.findUnique({
      where: { userId: user.id },
      select: { googleEmail: true },
    })
  );

  return NextResponse.json({
    data: { connected: !!auth, email: auth?.googleEmail || null },
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

  await withTenant(ctx.tenantId, () =>
    prisma.calendarAuth.delete({ where: { userId: user.id } })
  );

  return NextResponse.json({ data: { connected: false }, error: null });
}

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }

  const origin = new URL(request.url).origin;
  const authUrl = getAuthUrl(`${origin}/api/calendar/auth/callback`);

  return NextResponse.json({ data: { url: authUrl }, error: null });
}
