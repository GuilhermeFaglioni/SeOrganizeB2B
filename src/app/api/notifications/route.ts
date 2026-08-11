import { NextResponse } from "next/server";
import { prisma, withTenant } from "../../../../prisma/client";
import { getUser } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/authz/tenant-context";
import { noWorkspaceResponse } from "@/lib/authz/http";

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

  return withTenant(ctx.tenantId, async () => {
    const notifications = await prisma.notification.findMany({
      where: { recipientId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        activity: {
          include: {
            actor: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
      },
    });

    return NextResponse.json({
      data: {
        items: notifications,
        unreadCount: notifications.filter((item) => !item.readAt).length,
      },
      error: null,
    });
  });
}

export async function PATCH() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

  const result = await withTenant(ctx.tenantId, () =>
    prisma.notification.updateMany({
      where: { recipientId: user.id, readAt: null },
      data: { readAt: new Date() },
    })
  );
  return NextResponse.json({ data: { count: result.count }, error: null });
}
