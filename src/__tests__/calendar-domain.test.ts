import { describe, expect, it } from "vitest";
import {
  dedupeCalendarEvents,
  normalizeGoogleEvent,
} from "../lib/calendar/normalize";
import { normalizeAttendeeEmails } from "../lib/calendar/validation";
import type { CalendarEventData, GoogleCalendarEvent } from "../lib/calendar/types";

describe("normalizeGoogleEvent", () => {
  it("normalizes timed events and attendees", () => {
    const event = normalizeGoogleEvent({
      id: "google-1",
      summary: "Planning",
      description: "Weekly planning",
      start: {
        dateTime: "2026-07-30T09:00:00-03:00",
        timeZone: "America/Sao_Paulo",
      },
      end: {
        dateTime: "2026-07-30T10:00:00-03:00",
        timeZone: "America/Sao_Paulo",
      },
      attendees: [
        {
          email: "Teammate@Example.com",
          displayName: "Teammate",
          responseStatus: "accepted",
        },
      ],
    });

    expect(event).toMatchObject({
      id: "google-1",
      googleId: "google-1",
      title: "Planning",
      allDay: false,
      timeZone: "America/Sao_Paulo",
      source: "google",
    });
    expect(event.attendees).toEqual([
      expect.objectContaining({
        email: "teammate@example.com",
        displayName: "Teammate",
        responseStatus: "accepted",
      }),
    ]);
  });

  it("normalizes all-day events", () => {
    const event = normalizeGoogleEvent({
      id: "google-2",
      summary: "Holiday",
      start: { date: "2026-07-30" },
      end: { date: "2026-07-31" },
    });

    expect(event).toMatchObject({
      allDay: true,
      startTime: "2026-07-30",
      endTime: "2026-07-31",
      timeZone: null,
    });
  });

  it("rejects events without a usable time range", () => {
    expect(() =>
      normalizeGoogleEvent({
        id: "broken",
        summary: "Broken",
        start: {},
        end: {},
      } as GoogleCalendarEvent)
    ).toThrow("missing a valid start or end");
  });
});

describe("dedupeCalendarEvents", () => {
  it("keeps one event per googleId and preserves local task metadata", () => {
    const googleEvent: CalendarEventData = {
      id: "google-1",
      googleId: "google-1",
      title: "Planning",
      description: null,
      startTime: "2026-07-30T12:00:00.000Z",
      endTime: "2026-07-30T13:00:00.000Z",
      allDay: false,
      timeZone: null,
      color: null,
      source: "google",
      task: null,
      attendees: [],
    };
    const localMirror: CalendarEventData = {
      ...googleEvent,
      id: "local-1",
      task: { id: "task-1", title: "Prepare planning" },
      attendees: [
        {
          id: "attendee-1",
          profileId: "profile-1",
          email: "person@example.com",
          displayName: "Person",
          responseStatus: "needsAction",
          organizer: false,
        },
      ],
    };

    const merged = dedupeCalendarEvents([googleEvent, localMirror]);

    expect(merged).toHaveLength(1);
    expect(merged[0].task?.id).toBe("task-1");
    expect(merged[0].attendees).toHaveLength(1);
  });

  it("keeps unrelated local-only events", () => {
    const localEvent: CalendarEventData = {
      id: "local-only",
      googleId: null,
      title: "Local event",
      description: null,
      startTime: "2026-07-30T12:00:00.000Z",
      endTime: "2026-07-30T13:00:00.000Z",
      allDay: false,
      timeZone: null,
      color: null,
      source: "local",
      task: null,
      attendees: [],
    };

    expect(dedupeCalendarEvents([localEvent])).toEqual([localEvent]);
  });

  it("preserves the local row id when merging a Google mirror", () => {
    const remote: CalendarEventData = {
      id: "google-1",
      googleId: "google-1",
      title: "Planning",
      description: null,
      startTime: "2026-07-30T12:00:00.000Z",
      endTime: "2026-07-30T13:00:00.000Z",
      allDay: false,
      timeZone: null,
      color: null,
      source: "google",
      task: null,
      attendees: [],
    };
    const localMirror: CalendarEventData = {
      ...remote,
      id: "local-1",
    };

    expect(dedupeCalendarEvents([remote, localMirror])[0].id).toBe("local-1");
  });
});

describe("normalizeAttendeeEmails", () => {
  it("trims, lowercases and deduplicates valid addresses", () => {
    expect(
      normalizeAttendeeEmails([
        " A@Example.com ",
        "a@example.com",
        "person@example.org",
      ])
    ).toEqual(["a@example.com", "person@example.org"]);
  });

  it("rejects invalid email addresses", () => {
    expect(() => normalizeAttendeeEmails(["not-an-email"])).toThrow(
      "Invalid attendee email"
    );
  });
});
