import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../prisma/client";
import { getUser } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }

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

  const subscription = await prisma.pushSubscription.upsert({
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
    },
  });

  return NextResponse.json({ data: { id: subscription.id }, error: null });
}
