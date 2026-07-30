import { NextResponse } from "next/server";
import { prisma } from "../../../../../prisma/client";
import { getSession } from "@/lib/supabase/server";

export async function PATCH(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const result = await prisma.notification.updateMany({
    where: { id: params.id, recipientId: session.user.id },
    data: { readAt: new Date() },
  });
  if (result.count === 0) {
    return NextResponse.json(
      {
        data: null,
        error: { code: "NOT_FOUND", message: "Notification not found" },
      },
      { status: 404 }
    );
  }
  return NextResponse.json({ data: { id: params.id }, error: null });
}
