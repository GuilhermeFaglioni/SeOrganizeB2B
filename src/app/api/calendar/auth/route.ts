import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../prisma/client";
import { getUser } from "@/lib/supabase/server";
import { getAuthUrl } from "@/lib/google/oauth";

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }

  const auth = await prisma.calendarAuth.findUnique({
    where: { userId: user.id },
    select: { googleEmail: true },
  });

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

  await prisma.calendarAuth.delete({ where: { userId: user.id } });

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
