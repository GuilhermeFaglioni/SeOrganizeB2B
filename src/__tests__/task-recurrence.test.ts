import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (file: string) =>
  readFileSync(resolve(__dirname, "../..", file), "utf8");

describe("recurring task completion", () => {
  it("claims one generation and targets an incomplete column", () => {
    const helper = read("src/lib/tasks/complete-recurring-task.ts");
    expect(helper).toContain("recurrenceGeneratedAt: null");
    expect(helper).toContain("claimed.count !== 1");
    expect(helper).toContain("completesTasks: false");
    expect(helper).toContain("task.assignees.map");
  });

  it("runs only on incomplete to complete movement", () => {
    const route = read("src/app/api/tasks/[taskId]/route.ts");
    expect(route).toContain("task.column.completesTasks === false");
    expect(route).toContain("targetColumn?.completesTasks === true");
  });
});
