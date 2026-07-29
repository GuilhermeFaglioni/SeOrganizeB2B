import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../prisma/client";
import { getSession } from "@/lib/supabase/server";
import { getValidAccessToken } from "@/lib/google/oauth";
import { GoogleCalendarClient } from "@/lib/google/calendar";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }

  const body = await request.json();
  const { title, description, startTime, endTime, taskId, color } = body;

  if (!title || !startTime || !endTime) {
    return NextResponse.json({ data: null, error: { code: "VALIDATION_ERROR", message: "Title, startTime, and endTime are required" } }, { status: 400 });
  }

  let googleId: string | null = null;

  try {
    const accessToken = await getValidAccessToken(session.user.id);
    const client = new GoogleCalendarClient(accessToken);
    const result = await client.createEvent({
      summary: title,
      description: description || undefined,
      start: { dateTime: startTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      end: { dateTime: endTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    });
    googleId = result.id;
  } catch {
    // Google Calendar not connected; save locally only
  }

  const event = await prisma.calendarEvent.create({
    data: {
      userId: session.user.id,
      taskId: taskId || null,
      googleId,
      title,
      description: description || null,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      color: color || null,
      source: googleId ? "google" : "local",
    },
  });

  return NextResponse.json({ data: event, error: null }, { status: 201 });
}
