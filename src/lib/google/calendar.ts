const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";

interface GoogleEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime: string; timeZone?: string };
  end: { dateTime: string; timeZone?: string };
  colorId?: string;
}

interface CalendarEventInput {
  summary: string;
  description?: string;
  start: { dateTime: string; timeZone?: string };
  end: { dateTime: string; timeZone?: string };
}

interface TransformedEvent {
  id: string;
  googleId: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  color: string | null;
  source: "google";
}

export class GoogleCalendarClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async request(path: string, init?: RequestInit) {
    const res = await fetch(`${GOOGLE_CALENDAR_API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });

    if (!res.ok) {
      throw new Error(`Google Calendar API error: ${res.status}`);
    }

    return res.json();
  }

  async fetchEvents(timeMin: string, timeMax: string): Promise<TransformedEvent[]> {
    const data = await this.request(
      `/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime`
    );

    return (data.items || []).map((event: GoogleEvent) => ({
      id: event.id,
      googleId: event.id,
      title: event.summary,
      description: event.description || null,
      startTime: event.start.dateTime || event.start.dateTime,
      endTime: event.end.dateTime || event.end.dateTime,
      color: event.colorId || null,
      source: "google" as const,
    }));
  }

  async createEvent(input: CalendarEventInput): Promise<{ id: string }> {
    const data = await this.request("/calendars/primary/events", {
      method: "POST",
      body: JSON.stringify({
        summary: input.summary,
        description: input.description,
        start: input.start,
        end: input.end,
      }),
    });

    return { id: data.id };
  }

  async deleteEvent(googleId: string): Promise<void> {
    await this.request(`/calendars/primary/events/${googleId}`, {
      method: "DELETE",
    });
  }
}
