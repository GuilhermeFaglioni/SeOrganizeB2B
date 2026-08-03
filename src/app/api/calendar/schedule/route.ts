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
import { normalizeAttendeeEmails } from "@/lib/calendar/validation";
import { recordActivity } from "@/lib/activity/record";
import { sendPushToUsers, buildPushPayload } from "@/lib/push";
import { denyFor } from "@/lib/authz/authz";

interface ScheduleEventBody {
  title?: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  allDay?: boolean;
  timeZone?: string;
  taskId?: string;
  areaId?: string;
  color?: string;
  profileIds?: string[];
  attendeeEmails?: string[];
}

function parseEventDate(value: string, allDay: boolean): Date {
  return new Date(allDay ? `${value}T00:00:00.000Z` : value);
}

export async function POST(request: NextRequest) {
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
  const denied = await denyFor(user.id, "calendar.create");
  if (denied) return denied;

  const body = (await request.json()) as ScheduleEventBody;
  const title = body.title?.trim();
  const allDay = body.allDay ?? false;

  if (!title || !body.startTime || !body.endTime) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: "VALIDATION_ERROR",
          message: "Title, startTime, and endTime are required",
        },
      },
      { status: 400 },
    );
  }

  const startTime = parseEventDate(body.startTime, allDay);
  const endTime = parseEventDate(body.endTime, allDay);
  if (
    Number.isNaN(startTime.getTime()) ||
    Number.isNaN(endTime.getTime()) ||
    endTime <= startTime
  ) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: "VALIDATION_ERROR",
          message: "Event end must be after its start",
        },
      },
      { status: 400 },
    );
  }

  const profileIds = Array.from(
    new Set((body.profileIds ?? []).filter(Boolean)),
  );
  const profiles = await prisma.profile.findMany({
    where: { id: { in: profileIds } },
    select: { id: true, email: true, name: true },
  });
  if (body.areaId) {
    const area = await prisma.teamArea.findUnique({
      where: { id: body.areaId },
      select: { id: true },
    });
    if (!area) {
      return NextResponse.json(
        {
          data: null,
          error: { code: "VALIDATION_ERROR", message: "Team area not found" },
        },
        { status: 400 },
      );
    }
  }
  if (profiles.length !== profileIds.length) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: "VALIDATION_ERROR",
          message: "One or more attendees do not exist",
        },
      },
      { status: 400 },
    );
  }

  let attendeeEmails: string[];
  try {
    attendeeEmails = normalizeAttendeeEmails([
      ...(body.attendeeEmails ?? []),
      ...profiles.map((profile) => profile.email),
    ]);
  } catch (error) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: "VALIDATION_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Invalid attendee email",
        },
      },
      { status: 400 },
    );
  }

  const calendarAuth = await prisma.calendarAuth.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  let googleId: string | null = null;
  let googleEtag: string | null = null;

  if (calendarAuth) {
    try {
      const accessToken = await getValidAccessToken(user.id);
      const client = new GoogleCalendarClient(accessToken);
      const result = await client.createEvent({
        summary: title,
        description: body.description?.trim() || undefined,
        start: allDay
          ? { date: body.startTime }
          : {
              dateTime: body.startTime,
              timeZone: body.timeZone,
            },
        end: allDay
          ? { date: body.endTime }
          : {
              dateTime: body.endTime,
              timeZone: body.timeZone,
            },
        attendees: attendeeEmails.map((email) => ({ email })),
      });
      googleId = result.id;
      googleEtag = result.etag;
    } catch (error) {
      console.error("Google Calendar create failed:", error);
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
                : "Could not create Google Calendar event",
          },
        },
        { status: 502 },
      );
    }
  }

  const profileByEmail = new Map(
    profiles.map((profile) => [profile.email.toLowerCase(), profile]),
  );
  const transactionResult = await prisma.$transaction(async (tx) => {
    const created = await tx.calendarEvent.create({
      data: {
      userId: user.id,
      taskId: body.taskId || null,
      areaId: body.areaId || null,
      googleId,
      title,
      description: body.description?.trim() || null,
      startTime,
      endTime,
      allDay,
      timeZone: body.timeZone || null,
      color: body.color || null,
      etag: googleEtag,
      source: googleId ? "google" : "local",
      syncedAt: googleId ? new Date() : null,
      attendees: {
        create: attendeeEmails.map((email) => {
          const profile = profileByEmail.get(email);
          return {
            email,
            profileId: profile?.id ?? null,
            displayName: profile?.name ?? null,
          };
        }),
      },
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
    const activityResult = await recordActivity(tx, {
      actorId: user.id,
      taskId: body.taskId || null,
      type: "calendar.scheduled",
      entityType: "calendar_event",
      entityId: created.id,
      summary: `Agendou "${created.title}"`,
      notifyProfileIds: profileIds,
    });
    return { created, activityResult };
  });

  const { created: event, activityResult } = transactionResult;

  // Send push notifications after transaction commits
  if (activityResult && activityResult.notifiedProfileIds.length > 0) {
    const pushPayload = buildPushPayload({
      activityType: "calendar.scheduled",
      summary: `Agendou "${event.title}"`,
      actorName: user.email || "Sistema",
      entityType: "calendar_event",
      entityId: event.id,
    });
    if (pushPayload) {
      await sendPushToUsers(activityResult.notifiedProfileIds, pushPayload);
    }
  }

  return NextResponse.json({ data: event, error: null }, { status: 201 });
}
