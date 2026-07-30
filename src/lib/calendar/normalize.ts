import type {
  CalendarAttendee,
  CalendarEventData,
  GoogleCalendarEvent,
} from "./types";

export function normalizeGoogleEvent(
  event: GoogleCalendarEvent
): CalendarEventData {
  const startTime = event.start.dateTime ?? event.start.date;
  const endTime = event.end.dateTime ?? event.end.date;

  if (!startTime || !endTime) {
    throw new Error(`Google event ${event.id} is missing a valid start or end`);
  }

  return {
    id: event.id,
    googleId: event.id,
    title: event.summary?.trim() || "Untitled event",
    description: event.description?.trim() || null,
    startTime,
    endTime,
    allDay: Boolean(event.start.date && event.end.date),
    timeZone: event.start.timeZone ?? event.end.timeZone ?? null,
    color: event.colorId ?? null,
    source: "google",
    task: null,
    area: null,
    attendees: (event.attendees ?? []).map(
      (attendee): CalendarAttendee => ({
        profileId: null,
        email: attendee.email.trim().toLowerCase(),
        displayName: attendee.displayName?.trim() || null,
        responseStatus: attendee.responseStatus ?? "needsAction",
        organizer: attendee.organizer ?? false,
      })
    ),
  };
}

export function dedupeCalendarEvents(
  events: CalendarEventData[]
): CalendarEventData[] {
  const byKey = new Map<string, CalendarEventData>();

  for (const event of events) {
    const key = event.googleId ? `google:${event.googleId}` : `local:${event.id}`;
    const current = byKey.get(key);

    if (!current) {
      byKey.set(key, event);
      continue;
    }

    const remote = current.id === current.googleId ? current : event;
    const local = current.id === current.googleId ? event : current;
    const attendeeMap = new Map<string, CalendarAttendee>();

    for (const attendee of [...remote.attendees, ...local.attendees]) {
      const email = attendee.email.trim().toLowerCase();
      const previous = attendeeMap.get(email);
      attendeeMap.set(email, {
        ...previous,
        ...attendee,
        email,
        profileId: attendee.profileId ?? previous?.profileId ?? null,
      });
    }

    byKey.set(key, {
      ...remote,
      id: local.id,
      task: local.task ?? remote.task,
      area: local.area ?? remote.area,
      attendees: Array.from(attendeeMap.values()),
    });
  }

  return Array.from(byKey.values()).sort((a, b) =>
    a.startTime.localeCompare(b.startTime)
  );
}
