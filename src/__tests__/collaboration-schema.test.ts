import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const schema = readFileSync(
  resolve(__dirname, "../../prisma/schema.prisma"),
  "utf8"
);

describe("collaboration schema", () => {
  it("models multiple task assignees", () => {
    expect(schema).toContain("model TaskAssignee");
    expect(schema).toMatch(/assignees\s+TaskAssignee\[\]/);
    expect(schema).toContain("@@id([taskId, profileId])");
    expect(schema).toContain('@@map("task_assignees")');
  });

  it("models calendar event attendees", () => {
    expect(schema).toContain("model CalendarEventAttendee");
    expect(schema).toMatch(/attendees\s+CalendarEventAttendee\[\]/);
    expect(schema).toContain("@@unique([eventId, email])");
    expect(schema).toContain('@@map("calendar_event_attendees")');
  });

  it("removes the legacy scalar task assignee relation", () => {
    expect(schema).not.toMatch(/\bassigneeId\s+String\?/);
    expect(schema).not.toMatch(/\bassignee\s+Profile\?/);
  });
});
