import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const schema = readFileSync(
  resolve(__dirname, "../../prisma/schema.prisma"),
  "utf-8"
);

describe("operations cockpit schema", () => {
  it.each(["Activity", "Notification", "CommentMention", "SavedView"])(
    "defines %s",
    (model) => expect(schema).toContain(`model ${model} {`)
  );

  it("stores recurrence and explicit completion semantics", () => {
    expect(schema).toContain("recurrenceType");
    expect(schema).toContain("recurrenceGeneratedAt");
    expect(schema).toContain("completesTasks");
  });

  it("keeps notifications unique per recipient and activity", () => {
    expect(schema).toContain("@@unique([recipientId, activityId])");
  });
});
