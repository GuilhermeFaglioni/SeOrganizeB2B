import { NextResponse } from "next/server";
import { prisma } from "../../../../prisma/client";
import { getUser } from "@/lib/supabase/server";

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }

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
}

export async function PATCH() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const result = await prisma.notification.updateMany({
    where: { recipientId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  return NextResponse.json({ data: { count: result.count }, error: null });
}
