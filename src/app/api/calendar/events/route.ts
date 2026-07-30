import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../prisma/client";
import { getUser } from "@/lib/supabase/server";
import {
  getValidAccessToken,
  GoogleAuthError,
} from "@/lib/google/oauth";
import {
  GoogleCalendarClient,
  GoogleCalendarError,
} from "@/lib/google/calendar";
import { dedupeCalendarEvents } from "@/lib/calendar/normalize";
import type {
  CalendarEventData,
  CalendarResponseStatus,
} from "@/lib/calendar/types";
import { POST as createScheduledEvent } from "../schedule/route";

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      {
        data: null,
        error: { code: "AUTH_ERROR", message: "Unauthorized" },
      },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(request.url);
  const timeMin =
    searchParams.get("timeMin") ?? new Date().toISOString();
  const timeMax =
    searchParams.get("timeMax") ??
    new Date(Date.now() + 7 * 86_400_000).toISOString();
  const rangeStart = new Date(timeMin);
  const rangeEnd = new Date(timeMax);

  if (
    Number.isNaN(rangeStart.getTime()) ||
    Number.isNaN(rangeEnd.getTime()) ||
    rangeEnd <= rangeStart
  ) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid calendar range",
        },
      },
      { status: 400 },
    );
  }

  const [localEvents, calendarAuth] = await Promise.all([
    prisma.calendarEvent.findMany({
      where: {
        userId: user.id,
        startTime: { lt: rangeEnd },
        endTime: { gt: rangeStart },
      },
      orderBy: { startTime: "asc" },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            project: { select: { id: true, name: true } },
          },
        },
        area: { select: { id: true, name: true, color: true } },
        attendees: true,
      },
    }),
    prisma.calendarAuth.findUnique({
      where: { userId: user.id },
      select: { id: true, googleEmail: true },
    }),
  ]);

  const normalizedLocal: CalendarEventData[] = localEvents.map((event) => ({
    id: event.id,
    googleId: event.googleId,
    title: event.title,
    description: event.description,
    startTime: event.startTime.toISOString(),
    endTime: event.endTime.toISOString(),
    allDay: event.allDay,
    timeZone: event.timeZone,
    color: event.color,
    source: event.source === "google" ? "google" : "local",
    task: event.task,
    area: event.area,
    attendees: event.attendees.map((attendee) => ({
      id: attendee.id,
      profileId: attendee.profileId,
      email: attendee.email,
      displayName: attendee.displayName,
      responseStatus:
        attendee.responseStatus as CalendarResponseStatus,
      organizer: attendee.organizer,
    })),
  }));

  if (!calendarAuth) {
    return NextResponse.json({
      data: {
        events: normalizedLocal,
        connection: { connected: false, email: null },
      },
      error: null,
    });
  }

  try {
    const accessToken = await getValidAccessToken(user.id);
    const googleEvents = await new GoogleCalendarClient(
      accessToken,
    ).fetchEvents(timeMin, timeMax);

    return NextResponse.json({
      data: {
        events: dedupeCalendarEvents([...googleEvents, ...normalizedLocal]),
        connection: {
          connected: true,
          email: calendarAuth.googleEmail,
        },
      },
      error: null,
    });
  } catch (error) {
    console.error("Google Calendar fetch failed:", error);
    const code =
      error instanceof GoogleAuthError
        ? error.code
        : error instanceof GoogleCalendarError && error.status === 401
          ? "GOOGLE_AUTH_EXPIRED"
          : "GOOGLE_API_ERROR";
    return NextResponse.json(
      {
        data: null,
        error: {
          code,
          message:
            error instanceof Error
              ? error.message
              : "Could not load Google Calendar",
        },
      },
      { status: 502 },
    );
  }
}

export async function POST(request: NextRequest) {
  return createScheduledEvent(request);
}
