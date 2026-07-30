import { NextResponse } from "next/server";
import { prisma } from "../../../../prisma/client";
import { getSession } from "@/lib/supabase/server";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const notifications = await prisma.notification.findMany({
    where: { recipientId: session.user.id },
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
}

export async function PATCH() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const result = await prisma.notification.updateMany({
    where: { recipientId: session.user.id, readAt: null },
    data: { readAt: new Date() },
  });
  return NextResponse.json({ data: { count: result.count }, error: null });
}
