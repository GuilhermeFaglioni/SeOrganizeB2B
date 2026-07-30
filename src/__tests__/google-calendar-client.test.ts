import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GoogleCalendarClient,
  GoogleCalendarError,
} from "../lib/google/calendar";

describe("GoogleCalendarClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes timed and all-day events returned by Google", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            items: [
              {
                id: "timed",
                summary: "Timed",
                start: { dateTime: "2026-08-03T12:00:00-03:00" },
                end: { dateTime: "2026-08-03T13:00:00-03:00" },
              },
              {
                id: "all-day",
                summary: "All day",
                start: { date: "2026-08-04" },
                end: { date: "2026-08-05" },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const events = await new GoogleCalendarClient("token").fetchEvents(
      "2026-08-01T00:00:00.000Z",
      "2026-09-01T00:00:00.000Z",
    );

    expect(events).toEqual([
      expect.objectContaining({
        id: "timed",
        allDay: false,
        startTime: "2026-08-03T12:00:00-03:00",
      }),
      expect.objectContaining({
        id: "all-day",
        allDay: true,
        startTime: "2026-08-04",
        endTime: "2026-08-05",
      }),
    ]);
  });

  it("creates events with attendees and requests Google invitations", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "google-event-id" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await new GoogleCalendarClient("token").createEvent({
      summary: "Review",
      start: { dateTime: "2026-08-03T12:00:00-03:00" },
      end: { dateTime: "2026-08-03T13:00:00-03:00" },
      attendees: [{ email: "person@example.com" }],
    });

    expect(result).toEqual({ id: "google-event-id", etag: null });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/events?sendUpdates=all"),
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("person@example.com"),
      }),
    );
  });

  it("accepts empty 204 responses when deleting", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    );

    await expect(
      new GoogleCalendarClient("token").deleteEvent("google-event-id"),
    ).resolves.toBeUndefined();
  });

  it("exposes typed Google errors instead of silently succeeding", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message: "Token expired" } }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(
      new GoogleCalendarClient("token").fetchEvents(
        "2026-08-01T00:00:00.000Z",
        "2026-09-01T00:00:00.000Z",
      ),
    ).rejects.toEqual(
      expect.objectContaining<Partial<GoogleCalendarError>>({
        name: "GoogleCalendarError",
        status: 401,
        message: "Token expired",
      }),
    );
  });
});
