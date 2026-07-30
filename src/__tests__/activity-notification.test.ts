import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (file: string) =>
  readFileSync(resolve(__dirname, "../..", file), "utf8");

describe("activity and notifications", () => {
  it("deduplicates recipients and excludes the actor", () => {
    const source = read("src/lib/activity/record.ts");
    expect(source).toContain("new Set");
    expect(source).toContain("profileId !== input.actorId");
    expect(source).toContain("skipDuplicates: true");
  });

  it("polls in-app notifications every 30 seconds", () => {
    expect(read("src/hooks/use-notifications.ts")).toContain(
      "refetchInterval: 30_000"
    );
  });

  it("scopes notification mutations to the current recipient", () => {
    expect(read("src/app/api/notifications/[id]/route.ts")).toContain(
      "recipientId: user.id"
    );
    expect(read("src/app/api/notifications/route.ts")).toContain(
      "readAt: null"
    );
  });
});
