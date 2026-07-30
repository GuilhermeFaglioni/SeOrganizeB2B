import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (path: string) =>
  readFileSync(resolve(__dirname, "../..", path), "utf8");

describe("calendar experience contracts", () => {
  it("renders events with FullCalendar and its layout plugins", () => {
    const source = read("src/components/calendar/calendar-view.tsx");
    expect(source).toContain("@fullcalendar/react");
    expect(source).toContain("@fullcalendar/timegrid");
    expect(source).toContain("@fullcalendar/daygrid");
    expect(source).toContain("@fullcalendar/interaction");
    expect(source).toContain("select={(info)");
    expect(source).not.toContain("getEventPosition");
  });

  it("keeps the calendar visible without Google", () => {
    const source = read("src/app/(authenticated)/calendar/page.tsx");
    expect(source).toContain("<CalendarView");
    expect(source).toContain("Calendário local ativo");
  });

  it("shares one scheduling dialog across authenticated routes", () => {
    const layout = read("src/app/(authenticated)/layout.tsx");
    const provider = read("src/stores/schedule-event-context.tsx");
    expect(layout).toContain("ScheduleEventProvider");
    expect(provider).toContain("<ScheduleEventModal");
  });

  it("connects task scheduling and attendee selection", () => {
    const panel = read("src/components/kanban/task-detail-panel.tsx");
    const modal = read("src/components/calendar/schedule-event-modal.tsx");
    expect(panel).toContain("openScheduleEvent");
    expect(panel).toContain("profileIds");
    expect(modal).toContain("EventAttendeeSelector");
  });

  it("loads real upcoming tasks", () => {
    const source = read("src/hooks/use-calendar.ts");
    expect(source).toContain("/api/tasks/upcoming");
  });
});
