import { NextRequest, NextResponse } from "next/server";
import { prisma, withTenant } from "../../../../../prisma/client";
import { getUser } from "@/lib/supabase/server";
import { denyFor } from "@/lib/authz/authz";
import { getTenantContext } from "@/lib/authz/tenant-context";
import { noWorkspaceResponse } from "@/lib/authz/http";
import { getValidAccessToken } from "@/lib/google/oauth";
import { GoogleCalendarClient } from "@/lib/google/calendar";
import { dedupeCalendarEvents } from "@/lib/calendar/normalize";
import { eventsOverlap } from "@/lib/calendar/conflicts";
import type { CalendarEventData } from "@/lib/calendar/types";

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }
  const denied = await denyFor(user.id, "calendar.view");
  if (denied) return denied;

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

  const body = await request.json();
  const proposed = {
    startTime: String(body.startTime || ""),
    endTime: String(body.endTime || ""),
  };
  const start = new Date(proposed.startTime);
  const end = new Date(proposed.endTime);
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end <= start
  ) {
    return NextResponse.json(
      {
        data: null,
        error: { code: "VALIDATION_ERROR", message: "Invalid event range" },
      },
      { status: 400 }
    );
  }

  return withTenant(ctx.tenantId, async () => {
    const local = await prisma.calendarEvent.findMany({
      where: {
        userId: user.id,
        startTime: { lt: end },
        endTime: { gt: start },
      },
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
    });
    const normalizedLocal: CalendarEventData[] = local.map((event) => ({
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
        responseStatus: attendee.responseStatus as "needsAction",
        organizer: attendee.organizer,
      })),
    }));

    let googleStatus: "connected" | "not_connected" | "unavailable" =
      "not_connected";
    let googleEvents: CalendarEventData[] = [];
    const auth = await prisma.calendarAuth.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (auth) {
      try {
        googleEvents = await new GoogleCalendarClient(
          await getValidAccessToken(user.id)
        ).fetchEvents(start.toISOString(), end.toISOString());
        googleStatus = "connected";
      } catch (error) {
        console.error("Conflict lookup failed for Google Calendar:", error);
        googleStatus = "unavailable";
      }
    }

    const conflicts = dedupeCalendarEvents([
      ...googleEvents,
      ...normalizedLocal,
    ])
      .filter((event) => eventsOverlap(event, proposed))
      .map((event) => ({
        id: event.id,
        title: event.title,
        startTime: event.startTime,
        endTime: event.endTime,
        source: event.source,
      }));
    return NextResponse.json({
      data: { conflicts, googleStatus },
      error: null,
    });
  });
}
