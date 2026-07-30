import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { splitMentionContent } from "../lib/mentions";

const read = (file: string) =>
  readFileSync(resolve(__dirname, "../..", file), "utf8");

describe("comment mentions", () => {
  it("splits canonical mentions for styled rendering", () => {
    expect(splitMentionContent("Oi @[Ana](p-1)!")).toEqual([
      { type: "text", value: "Oi " },
      { type: "mention", value: "@Ana", profileId: "p-1" },
      { type: "text", value: "!" },
    ]);
  });

  it("validates and persists mentions transactionally", () => {
    const route = read("src/app/api/tasks/[taskId]/comments/route.ts");
    expect(route).toContain("extractMentionProfileIds");
    expect(route).toContain("prisma.$transaction");
    expect(route).toContain("mentions:");
    expect(route).toContain("recordActivity");
  });

  it("offers profile autocomplete after @", () => {
    const input = read("src/components/comments/comment-input.tsx");
    expect(input).toContain("/@([\\w.-]*)$/");
    expect(input).toContain("@[${label}](${profile.id})");
  });
});
