export type CalendarResponseStatus =
  | "accepted"
  | "declined"
  | "tentative"
  | "needsAction";

export interface CalendarAttendee {
  id?: string;
  profileId: string | null;
  email: string;
  displayName: string | null;
  responseStatus: CalendarResponseStatus;
  organizer: boolean;
}

export interface CalendarEventData {
  id: string;
  googleId: string | null;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  allDay: boolean;
  timeZone: string | null;
  color: string | null;
  source: "google" | "local";
  task: {
    id: string;
    title: string;
    project?: { id: string; name: string };
  } | null;
  area?: { id: string; name: string; color: string } | null;
  attendees: CalendarAttendee[];
}

export interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  colorId?: string;
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: CalendarResponseStatus;
    organizer?: boolean;
  }>;
}
