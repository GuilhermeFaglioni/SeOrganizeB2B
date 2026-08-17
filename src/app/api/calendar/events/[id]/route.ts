import { NextRequest, NextResponse } from "next/server";
import { prisma, withTenant } from "../../../../../../prisma/client";
import { getUser } from "@/lib/supabase/server";
import {
  getValidAccessToken,
  GoogleAuthError,
  markCalendarReconnectRequired,
} from "@/lib/google/oauth";
import {
  GoogleCalendarClient,
  GoogleCalendarError,
} from "@/lib/google/calendar";
import { recordActivity } from "@/lib/activity/record";
import { normalizeAttendeeEmails } from "@/lib/calendar/validation";
import { denyFor } from "@/lib/authz/authz";
import { getTenantContext } from "@/lib/authz/tenant-context";
import { noWorkspaceResponse } from "@/lib/authz/http";
import { applyFeatureGate, withFeatureWarning } from "@/lib/middleware/feature-gating";

function parseOptionalBool(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  return undefined;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 },
    );
  }
  const denied = await denyFor(user.id, "calendar.edit");
  if (denied) return denied;
  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

  const gate = await applyFeatureGate({
    userId: user.id,
    pathname: "/api/calendar/events/[id]",
    method: "PATCH",
    tenantContext: ctx,
  });
  if (gate.response) return gate.response;

  return withTenant(ctx.tenantId, async () => {
    const event = await prisma.calendarEvent.findUnique({
      where: { id: params.id },
      include: { attendees: true },
    });
    if (!event) {
      return NextResponse.json(
        { data: null, error: { code: "NOT_FOUND", message: "Event not found" } },
        { status: 404 },
      );
    }
    if (event.userId !== user.id) {
      return NextResponse.json(
        {
          data: null,
          error: { code: "FORBIDDEN", message: "Cannot edit another user's event" },
        },
        { status: 403 },
      );
    }

    const body = await request.json();

    const taskId =
      body.taskId === null || typeof body.taskId === "string"
        ? body.taskId
        : undefined;

    const areaId =
      body.areaId === null || typeof body.areaId === "string"
        ? body.areaId
        : undefined;

    const title =
      typeof body.title === "string" ? body.title.trim() : undefined;
    const description =
      body.description === null || typeof body.description === "string"
        ? body.description?.trim() ?? null
        : undefined;
    const allDay = parseOptionalBool(body.allDay);
    const timeZone =
      body.timeZone === null || typeof body.timeZone === "string"
        ? body.timeZone ?? null
        : undefined;
    const color =
      body.color === null || typeof body.color === "string"
        ? body.color ?? null
        : undefined;

    let startTime: Date | undefined;
    let endTime: Date | undefined;
    if (body.startTime) {
      startTime = new Date(allDay ? `${body.startTime}T00:00:00.000Z` : body.startTime);
      if (Number.isNaN(startTime.getTime())) startTime = undefined;
    }
    if (body.endTime) {
      endTime = new Date(allDay ? `${body.endTime}T00:00:00.000Z` : body.endTime);
      if (Number.isNaN(endTime.getTime())) endTime = undefined;
    }
    if (startTime && endTime && endTime <= startTime) {
      return NextResponse.json(
        {
          data: null,
          error: { code: "VALIDATION_ERROR", message: "Event end must be after its start" },
        },
        { status: 400 },
      );
    }

    if (taskId) {
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: { id: true },
      });
      if (!task) {
        return NextResponse.json(
          { data: null, error: { code: "VALIDATION_ERROR", message: "Task not found" } },
          { status: 400 },
        );
      }
    }
    if (areaId) {
      const area = await prisma.teamArea.findUnique({
        where: { id: areaId },
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

    let attendeeEmails: string[] | undefined;
    if (body.attendeeEmails !== undefined || body.profileIds !== undefined) {
      const rawEmails = Array.isArray(body.attendeeEmails) ? body.attendeeEmails : [];
      const rawProfileIds = Array.isArray(body.profileIds) ? body.profileIds.filter(Boolean) : [];
      const profiles = rawProfileIds.length > 0
        ? await prisma.profile.findMany({
            where: { id: { in: rawProfileIds } },
            select: { email: true },
          })
        : [];
      try {
        attendeeEmails = normalizeAttendeeEmails([
          ...rawEmails,
          ...profiles.map((p) => p.email),
        ]);
      } catch (error) {
        return NextResponse.json(
          {
            data: null,
            error: { code: "VALIDATION_ERROR", message: error instanceof Error ? error.message : "Invalid attendee email" },
          },
          { status: 400 },
        );
      }
    }

    const googlePayload = title || description || startTime || endTime || allDay !== undefined || timeZone !== undefined || attendeeEmails !== undefined;
    let etag: string | null = null;
    if (event.googleId && googlePayload) {
      try {
        const accessToken = await getValidAccessToken(user.id);
        const client = new GoogleCalendarClient(accessToken);
        const result = await client.updateEvent(event.googleId, {
          summary: title ?? event.title,
          description: description !== undefined ? (description ?? undefined) : (event.description ?? undefined),
          start: startTime
            ? allDay !== undefined && allDay
              ? { date: body.startTime! }
              : { dateTime: startTime.toISOString(), timeZone: timeZone ?? event.timeZone ?? undefined }
            : allDay !== undefined && allDay
              ? { date: event.startTime.toISOString().split("T")[0] }
              : { dateTime: event.startTime.toISOString(), timeZone: event.timeZone ?? undefined },
          end: endTime
            ? allDay !== undefined && allDay
              ? { date: body.endTime! }
              : { dateTime: endTime.toISOString(), timeZone: timeZone ?? event.timeZone ?? undefined }
            : allDay !== undefined && allDay
              ? { date: event.endTime.toISOString().split("T")[0] }
              : { dateTime: event.endTime.toISOString(), timeZone: event.timeZone ?? undefined },
          attendees: attendeeEmails
            ? attendeeEmails.map((email) => ({ email }))
            : undefined,
        });
        etag = result.etag;
      } catch (error) {
        console.error("Google Calendar update failed:", error);
        if (error instanceof GoogleCalendarError && error.status === 401) {
          await markCalendarReconnectRequired(user.id, "GOOGLE_AUTH_EXPIRED");
        }
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
                code === "GOOGLE_AUTH_RECONNECT_REQUIRED" ||
                code === "GOOGLE_AUTH_EXPIRED"
                  ? "Reconnect Google Calendar to update events"
                  : "Could not update Google Calendar event",
            },
          },
          { status: 502 },
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (taskId !== undefined) updateData.taskId = taskId;
    if (areaId !== undefined) updateData.areaId = areaId;
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (startTime !== undefined) updateData.startTime = startTime;
    if (endTime !== undefined) updateData.endTime = endTime;
    if (allDay !== undefined) updateData.allDay = allDay;
    if (timeZone !== undefined) updateData.timeZone = timeZone;
    if (color !== undefined) updateData.color = color;
    if (etag) updateData.etag = etag;
    updateData.syncedAt = new Date();

    if (Object.keys(updateData).length === 1) {
      return NextResponse.json(
        {
          data: null,
          error: { code: "VALIDATION_ERROR", message: "No valid changes supplied" },
        },
        { status: 400 },
      );
    }

    const profiles =
      attendeeEmails && attendeeEmails.length > 0
        ? await prisma.profile.findMany({
            where: { email: { in: attendeeEmails, mode: "insensitive" } },
            select: { id: true, email: true, name: true },
          })
        : [];
    const profileByEmail = new Map(
      profiles.map((p) => [p.email.toLowerCase(), p]),
    );
    const activityType = taskId !== undefined || areaId !== undefined
      ? "calendar.links_updated"
      : "calendar.updated";

    const updated = await prisma.$transaction(async (tx) => {
      if (attendeeEmails) {
        await tx.calendarEventAttendee.deleteMany({
          where: { eventId: params.id },
        });
      }
      const result = await tx.calendarEvent.update({
        where: { id: params.id },
        data: {
          ...updateData,
          ...(attendeeEmails
            ? {
                attendees: {
                  create: attendeeEmails.map((email) => {
                    const profile = profileByEmail.get(email);
                    return {
                      email,
                      profileId: profile?.id ?? null,
                      displayName: profile?.name ?? null,
                      tenantId: ctx.tenantId!,
                    };
                  }),
                },
              }
            : {}),
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
      await recordActivity(tx, {
        actorId: user.id,
        taskId: result.taskId,
        type: activityType,
        entityType: "calendar_event",
        entityId: result.id,
        summary: activityType === "calendar.links_updated"
          ? `Atualizou vínculos de “${result.title}”`
          : `Editou o evento “${result.title}”`,
      });
      return result;
    });
    return withFeatureWarning(
      NextResponse.json({ data: updated, error: null }),
      gate.warning
    );
  });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }
  const denied = await denyFor(user.id, "calendar.delete");
  if (denied) return denied;

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

  const gate = await applyFeatureGate({
    userId: user.id,
    pathname: "/api/calendar/events/[id]",
    method: "DELETE",
    tenantContext: ctx,
  });
  if (gate.response) return gate.response;

  return withTenant(ctx.tenantId, async () => {
    const event = await prisma.calendarEvent.findUnique({ where: { id: params.id } });
    if (!event) {
      return NextResponse.json({ data: null, error: { code: "NOT_FOUND", message: "Event not found" } }, { status: 404 });
    }

    if (event.userId !== user.id) {
      return NextResponse.json({ data: null, error: { code: "FORBIDDEN", message: "Cannot delete another user's event" } }, { status: 403 });
    }

    if (event.googleId) {
      try {
        const accessToken = await getValidAccessToken(user.id);
        const client = new GoogleCalendarClient(accessToken);
        await client.deleteEvent(event.googleId);
      } catch (error) {
        console.error("Google Calendar delete failed:", error);
        if (error instanceof GoogleCalendarError && error.status === 401) {
          await markCalendarReconnectRequired(user.id, "GOOGLE_AUTH_EXPIRED");
        }
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
                code === "GOOGLE_AUTH_RECONNECT_REQUIRED" ||
                code === "GOOGLE_AUTH_EXPIRED"
                  ? "Reconnect Google Calendar to delete events"
                  : "Could not delete Google Calendar event",
            },
          },
          { status: 502 },
        );
      }
    }

    await prisma.calendarEvent.delete({ where: { id: params.id } });

    return withFeatureWarning(
      NextResponse.json({ data: { id: params.id }, error: null }),
      gate.warning
    );
  });
}
