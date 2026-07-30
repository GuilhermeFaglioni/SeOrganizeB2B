import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { eventsOverlap } from "../lib/calendar/conflicts";

const read = (file: string) =>
  readFileSync(resolve(__dirname, "../..", file), "utf8");

describe("calendar conflict warning", () => {
  it("uses strict overlap boundaries", () => {
    expect(
      eventsOverlap(
        { startTime: "2026-07-30T09:00:00Z", endTime: "2026-07-30T10:00:00Z" },
        { startTime: "2026-07-30T10:00:00Z", endTime: "2026-07-30T11:00:00Z" }
      )
    ).toBe(false);
  });

  it("deduplicates Google and local conflicts", () => {
    const route = read("src/app/api/calendar/conflicts/route.ts");
    expect(route).toContain("dedupeCalendarEvents");
    expect(route).toContain('googleStatus = "unavailable"');
  });

  it("requires explicit non-blocking continuation", () => {
    const modal = read(
      "src/components/calendar/schedule-event-modal.tsx"
    );
    expect(modal).toContain("Criar mesmo assim");
    expect(modal).toContain("Aviso não bloqueia criação");
  });
});
