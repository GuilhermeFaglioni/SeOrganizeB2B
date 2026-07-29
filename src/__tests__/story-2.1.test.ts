import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function read(filename: string): string {
  return readFileSync(resolve(__dirname, "../..", filename), "utf-8");
}

function exists(filename: string): boolean {
  return existsSync(resolve(__dirname, "../..", filename));
}

describe("2.1.1 Google OAuth helper", () => {
  it("src/lib/google/oauth.ts exports getValidAccessToken and getAuthUrl", () => {
    expect(exists("src/lib/google/oauth.ts")).toBe(true);
    const src = read("src/lib/google/oauth.ts");
    expect(src).toContain("getValidAccessToken");
    expect(src).toContain("getAuthUrl");
    expect(src).toContain("refreshToken");
  });
});

describe("2.1.2 Google Calendar API client", () => {
  it("src/lib/google/calendar.ts exports GoogleCalendarClient", () => {
    expect(exists("src/lib/google/calendar.ts")).toBe(true);
    const src = read("src/lib/google/calendar.ts");
    expect(src).toContain("GoogleCalendarClient");
    expect(src).toContain("fetchEvents");
    expect(src).toContain("createEvent");
    expect(src).toContain("deleteEvent");
  });
});

describe("2.1.3 Calendar API routes", () => {
  it("GET/DELETE /api/calendar/auth/route.ts exists", () => {
    expect(exists("src/app/api/calendar/auth/route.ts")).toBe(true);
    const src = read("src/app/api/calendar/auth/route.ts");
    expect(src).toContain("export async function GET");
    expect(src).toContain("export async function DELETE");
    expect(src).toContain("calendarAuth");
  });

  it("GET /api/calendar/events/route.ts exists", () => {
    expect(exists("src/app/api/calendar/events/route.ts")).toBe(true);
    const src = read("src/app/api/calendar/events/route.ts");
    expect(src).toContain("export async function GET");
    expect(src).toContain("timeMin");
    expect(src).toContain("timeMax");
  });

  it("POST /api/calendar/schedule/route.ts exists", () => {
    expect(exists("src/app/api/calendar/schedule/route.ts")).toBe(true);
    const src = read("src/app/api/calendar/schedule/route.ts");
    expect(src).toContain("export async function POST");
    expect(src).toContain("googleId");
  });

  it("DELETE /api/calendar/events/[id]/route.ts exists", () => {
    expect(exists("src/app/api/calendar/events/[id]/route.ts")).toBe(true);
    const src = read("src/app/api/calendar/events/[id]/route.ts");
    expect(src).toContain("export async function DELETE");
    expect(src).toContain("params.id");
  });
});

describe("2.1.4 useCalendar hook", () => {
  it("exports useCalendarAuth, useCalendarEvents, useScheduleEvent", () => {
    const src = read("src/hooks/use-calendar.ts");
    expect(src).toMatch(/useCalendarAuth/);
    expect(src).toMatch(/useCalendarEvents/);
    expect(src).toMatch(/useScheduleEvent/);
    expect(src).toContain("@tanstack/react-query");
  });
});

describe("2.1.5 CalendarEvent component", () => {
  it("renders with left border, time, title", () => {
    const src = read("src/components/calendar/calendar-event.tsx");
    expect(src).toContain("CalendarEvent");
    expect(src).toContain("border-l");
    expect(src).toContain("title");
    expect(src).toContain("startTime");
  });
});

describe("2.1.6 CalendarView component", () => {
  it("renders week grid with time slots", () => {
    const src = read("src/components/calendar/calendar-view.tsx");
    expect(src).toContain('data-testid="calendar-view"');
    expect(src).toContain("CalendarEvent");
    expect(src).toContain("useCalendarEvents");
  });
});

describe("2.1.7 ScheduleEventModal", () => {
  it("renders modal with date picker, duration, pre-fills task title", () => {
    const src = read("src/components/calendar/schedule-event-modal.tsx");
    expect(src).toContain("Dialog");
    expect(src).toContain("title");
    expect(src).toContain("duration");
    expect(src).toContain("useScheduleEvent");
  });
});

describe("2.1.8 UpcomingTasksPanel", () => {
  it("renders tasks sorted by due date with priority colors", () => {
    const src = read("src/components/calendar/upcoming-tasks-panel.tsx");
    expect(src).toContain("upcoming-tasks");
    expect(src).toContain("dueDate");
    expect(src).toContain("priority");
  });
});

describe("2.1.9 Calendar page", () => {
  it("renders calendar page with CalendarView, UpcomingTasksPanel, connect button", () => {
    expect(exists("src/app/(authenticated)/calendar/page.tsx")).toBe(true);
    const src = read("src/app/(authenticated)/calendar/page.tsx");
    expect(src).toContain('data-testid="calendar-page"');
    expect(src).toContain("CalendarView");
    expect(src).toContain("UpcomingTasksPanel");
    expect(src).toContain("connect-google-calendar");
  });
});
