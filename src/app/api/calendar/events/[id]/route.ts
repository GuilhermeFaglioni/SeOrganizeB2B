import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../../prisma/client";
import { getSession } from "@/lib/supabase/server";
import { getValidAccessToken } from "@/lib/google/oauth";
import { GoogleCalendarClient } from "@/lib/google/calendar";

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
    } catch {
      // Continue with local deletion even if Google deletion fails
    }
  }

  await prisma.calendarEvent.delete({ where: { id: params.id } });

  return NextResponse.json({ data: { id: params.id }, error: null });
}
