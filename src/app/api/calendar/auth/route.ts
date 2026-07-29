import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../prisma/client";
import { getSession } from "@/lib/supabase/server";
import { getAuthUrl } from "@/lib/google/oauth";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }

  const auth = await prisma.calendarAuth.findUnique({
    where: { userId: session.user.id },
    select: { googleEmail: true },
  });

  return NextResponse.json({
    data: { connected: !!auth, email: auth?.googleEmail || null },
    error: null,
  });
}

export async function DELETE() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }

  await prisma.calendarAuth.delete({ where: { userId: session.user.id } });

  return NextResponse.json({ data: { connected: false }, error: null });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }

  const origin = new URL(request.url).origin;
  const authUrl = getAuthUrl(`${origin}/api/calendar/auth/callback`);

  return NextResponse.json({ data: { url: authUrl }, error: null });
}
