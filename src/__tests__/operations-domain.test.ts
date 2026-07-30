import { describe, expect, it } from "vitest";
import {
  extractMentionProfileIds,
  stripMentionMarkup,
} from "../lib/mentions";
import { nextRecurrenceDate } from "../lib/recurrence";
import { eventsOverlap } from "../lib/calendar/conflicts";

describe("mention tokens", () => {
  it("extracts valid profile ids once", () => {
    expect(
      extractMentionProfileIds(
        "Oi @[Ana](profile-1), copie @[Bia](profile-2) e @[Ana](profile-1)"
      )
    ).toEqual(["profile-1", "profile-2"]);
  });

  it("rejects malformed tokens and strips canonical markup", () => {
    expect(extractMentionProfileIds("@Ana(profile-1) @[Sem id]()")).toEqual([]);
    expect(stripMentionMarkup("Oi @[Ana](profile-1)!")).toBe("Oi @Ana!");
  });
});

describe("recurrence", () => {
  it("adds daily and weekly intervals", () => {
    expect(
      nextRecurrenceDate(new Date("2026-07-30T12:00:00Z"), "daily", 2).toISOString()
    ).toBe("2026-08-01T12:00:00.000Z");
    expect(
      nextRecurrenceDate(
        new Date("2026-07-30T12:00:00Z"),
        "weekly",
        2
      ).toISOString()
    ).toBe("2026-08-13T12:00:00.000Z");
  });

  it("clamps monthly recurrence to the target month", () => {
    expect(
      nextRecurrenceDate(
        new Date("2026-01-31T12:00:00Z"),
        "monthly",
        1
      ).toISOString()
    ).toBe("2026-02-28T12:00:00.000Z");
  });
});

describe("event overlap", () => {
  const event = {
    startTime: "2026-07-30T12:00:00.000Z",
    endTime: "2026-07-30T13:00:00.000Z",
  };

  it("detects intersections", () => {
    expect(
      eventsOverlap(event, {
        startTime: "2026-07-30T12:30:00.000Z",
        endTime: "2026-07-30T13:30:00.000Z",
      })
    ).toBe(true);
  });

  it("does not treat touching boundaries as overlap", () => {
    expect(
      eventsOverlap(event, {
        startTime: "2026-07-30T13:00:00.000Z",
        endTime: "2026-07-30T14:00:00.000Z",
      })
    ).toBe(false);
  });
});
