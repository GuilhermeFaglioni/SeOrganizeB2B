import { NextRequest, NextResponse } from "next/server";
import { prisma, withTenant } from "../../../../../prisma/client";
import { getUser } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/authz/tenant-context";
import { noWorkspaceResponse } from "@/lib/authz/http";

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

  const body = await request.json();
  const { endpoint, p256dh, auth } = body;

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: "VALIDATION_ERROR",
          message: "endpoint, p256dh, and auth are required",
        },
      },
      { status: 400 }
    );
  }

  const subscription = await withTenant(ctx.tenantId, () =>
    prisma.pushSubscription.upsert({
      where: { endpoint },
      update: {
        profileId: user.id,
        p256dh,
        auth,
      },
      create: {
        profileId: user.id,
        endpoint,
        p256dh,
        auth,
        tenantId: ctx.tenantId!,
      },
    })
  );

  return NextResponse.json({ data: { id: subscription.id }, error: null });
}
