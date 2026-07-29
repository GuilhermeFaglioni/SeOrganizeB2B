import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../prisma/client";
import { getSession } from "@/lib/supabase/server";
import { getValidAccessToken } from "@/lib/google/oauth";
import { GoogleCalendarClient } from "@/lib/google/calendar";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const timeMin = searchParams.get("timeMin");
  const timeMax = searchParams.get("timeMax");

  const localEvents = await prisma.calendarEvent.findMany({
    where: {
      userId: session.user.id,
      ...(timeMin && { startTime: { gte: new Date(timeMin) } }),
      ...(timeMax && { endTime: { lte: new Date(timeMax) } }),
    },
    orderBy: { startTime: "asc" },
    include: { task: { select: { id: true, title: true } } },
  });

  let googleEvents: { id: string; googleId: string; title: string; description: string | null; startTime: string; endTime: string; color: string | null; source: "google" }[] = [];

  try {
    const accessToken = await getValidAccessToken(session.user.id);
    const client = new GoogleCalendarClient(accessToken);
    googleEvents = await client.fetchEvents(
      timeMin || new Date().toISOString(),
      timeMax || new Date(Date.now() + 7 * 86400000).toISOString()
    );
  } catch {
    // Google Calendar not connected or token refresh failed; return only local events
  }

  const merged = [
    ...googleEvents,
    ...localEvents.map((e) => ({
      id: e.id,
      googleId: e.googleId || e.id,
      title: e.title,
      description: e.description,
      startTime: e.startTime.toISOString(),
      endTime: e.endTime.toISOString(),
      color: e.color,
      source: e.source as "google",
      task: e.task ? { id: e.task.id, title: e.task.title } : null,
    })),
  ];

  return NextResponse.json({ data: merged, error: null });
}
