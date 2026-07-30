import { normalizeGoogleEvent } from "../calendar/normalize";
import type {
  CalendarEventData,
  GoogleCalendarEvent,
} from "../calendar/types";

const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";

interface CalendarEventInput {
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  attendees?: Array<{ email: string }>;
}

interface GoogleErrorPayload {
  error?: { message?: string };
}

export class GoogleCalendarError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "GoogleCalendarError";
    this.status = status;
  }
}

interface CreateResult {
  id: string;
  etag: string | null;
}

interface UpdateResult {
  etag: string | null;
}

export class GoogleCalendarClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T | null> {
    const response = await fetch(`${GOOGLE_CALENDAR_API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
    const body = await response.text();

    if (!response.ok) {
      let message = `Google Calendar API error: ${response.status}`;

      if (body) {
        try {
          const payload = JSON.parse(body) as GoogleErrorPayload;
          message = payload.error?.message || message;
        } catch {
          message = body;
        }
      }

      throw new GoogleCalendarError(message, response.status);
    }

    return body ? (JSON.parse(body) as T) : null;
  }

  async fetchEvents(
    timeMin: string,
    timeMax: string,
  ): Promise<CalendarEventData[]> {
    const data = await this.request<{ items?: GoogleCalendarEvent[] }>(
      `/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime`,
    );

    return (data?.items ?? []).map(normalizeGoogleEvent);
  }

  async createEvent(input: CalendarEventInput): Promise<CreateResult> {
    const data = await this.request<{ id: string; etag?: string }>(
      "/calendars/primary/events?sendUpdates=all",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );

    if (!data?.id) {
      throw new GoogleCalendarError(
        "Google Calendar returned an invalid event",
        502,
      );
    }

    return { id: data.id, etag: data.etag ?? null };
  }

  async updateEvent(
    googleId: string,
    input: CalendarEventInput,
  ): Promise<UpdateResult> {
    const data = await this.request<{ etag?: string }>(
      `/calendars/primary/events/${encodeURIComponent(googleId)}?sendUpdates=all`,
      {
        method: "PUT",
        body: JSON.stringify(input),
      },
    );

    return { etag: data?.etag ?? null };
  }

  async deleteEvent(googleId: string): Promise<void> {
    await this.request(
      `/calendars/primary/events/${encodeURIComponent(googleId)}?sendUpdates=all`,
      { method: "DELETE" },
    );
  }
}
