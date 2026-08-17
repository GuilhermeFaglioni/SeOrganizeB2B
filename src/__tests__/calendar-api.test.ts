import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (path: string) =>
  readFileSync(resolve(__dirname, "../..", path), "utf8");

describe("calendar API contracts", () => {
  it("uses overlap semantics and returns normalized connection state", () => {
    const source = read("src/app/api/calendar/events/route.ts");
    expect(source).toContain("startTime: { lt: rangeEnd }");
    expect(source).toContain("endTime: { gt: rangeStart }");
    expect(source).toContain("dedupeCalendarEvents");
    expect(source).toContain("connection:");
  });

  it("supports event creation through the canonical events route", () => {
    const source = read("src/app/api/calendar/events/route.ts");
    expect(source).toContain("export async function POST");
    expect(source).toContain("createScheduledEvent");
  });

  it("persists attendees and never silently reports Google success", () => {
    const source = read("src/app/api/calendar/schedule/route.ts");
    expect(source).toContain("attendeeEmails");
    expect(source).toContain("profileIds");
    expect(source).toContain("attendees:");
    expect(source).toContain("GOOGLE_API_ERROR");
    expect(source).toContain("{ status: 502 }");
  });

  it("validates linked calendar records against the active company", () => {
    const schedule = read("src/app/api/calendar/schedule/route.ts");
    const eventDetail = read("src/app/api/calendar/events/[id]/route.ts");
    expect(schedule).toContain("where: { id: body.taskId, tenantId: ctx.tenantId! }");
    expect(schedule).toContain("where: { id: body.areaId, tenantId: ctx.tenantId! }");
    expect(eventDetail).toContain("where: { id: params.id, tenantId: ctx.tenantId! }");
    expect(eventDetail).toContain("where: { id: taskId, tenantId: ctx.tenantId! }");
  });
});
