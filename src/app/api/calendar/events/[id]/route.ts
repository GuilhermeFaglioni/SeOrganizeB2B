import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../../prisma/client";
import { getSession } from "@/lib/supabase/server";
import {
  getValidAccessToken,
  GoogleAuthError,
} from "@/lib/google/oauth";
import {
  GoogleCalendarClient,
  GoogleCalendarError,
} from "@/lib/google/calendar";
import { recordActivity } from "@/lib/activity/record";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 },
    );
  }
  const event = await prisma.calendarEvent.findUnique({
    where: { id: params.id },
  });
  if (!event) {
    return NextResponse.json(
      { data: null, error: { code: "NOT_FOUND", message: "Event not found" } },
      { status: 404 },
    );
  }
  if (event.userId !== session.user.id) {
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
  if (taskId === undefined && areaId === undefined) {
    return NextResponse.json(
      {
        data: null,
        error: { code: "VALIDATION_ERROR", message: "No valid changes supplied" },
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
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.calendarEvent.update({
      where: { id: params.id },
      data: {
        ...(taskId !== undefined ? { taskId } : {}),
        ...(areaId !== undefined ? { areaId } : {}),
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
      actorId: session.user.id,
      taskId: result.taskId,
      type: "calendar.links_updated",
      entityType: "calendar_event",
      entityId: result.id,
      summary: `Atualizou vínculos de “${result.title}”`,
    });
    return result;
  });
  return NextResponse.json({ data: updated, error: null });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }

  const event = await prisma.calendarEvent.findUnique({ where: { id: params.id } });
  if (!event) {
    return NextResponse.json({ data: null, error: { code: "NOT_FOUND", message: "Event not found" } }, { status: 404 });
  }

  if (event.userId !== session.user.id) {
    return NextResponse.json({ data: null, error: { code: "FORBIDDEN", message: "Cannot delete another user's event" } }, { status: 403 });
  }

  if (event.googleId) {
    try {
      const accessToken = await getValidAccessToken(session.user.id);
      const client = new GoogleCalendarClient(accessToken);
      await client.deleteEvent(event.googleId);
    } catch (error) {
      console.error("Google Calendar delete failed:", error);
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
                : "Could not delete Google Calendar event",
          },
        },
        { status: 502 },
      );
    }
  }

  await prisma.calendarEvent.delete({ where: { id: params.id } });

  return NextResponse.json({ data: { id: params.id }, error: null });
}
