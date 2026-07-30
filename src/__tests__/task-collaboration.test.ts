import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(resolve(__dirname, "../..", path), "utf8");
}

describe("task collaboration contracts", () => {
  it("creates and updates tasks with assigneeIds", () => {
    const createRoute = read(
      "src/app/api/projects/[projectId]/tasks/route.ts"
    );
    const updateRoute = read("src/app/api/tasks/[taskId]/route.ts");

    expect(createRoute).toContain("assigneeIds");
    expect(createRoute).toContain("assignees:");
    expect(updateRoute).toContain("assigneeIds");
    expect(updateRoute).toContain("deleteMany");
  });

  it("returns assignees in board and task queries", () => {
    const columnsRoute = read(
      "src/app/api/projects/[projectId]/columns/route.ts"
    );
    const taskRoute = read("src/app/api/tasks/[taskId]/route.ts");

    expect(columnsRoute).toContain("assignees:");
    expect(taskRoute).toContain("assignees:");
  });

  it("provides upcoming tasks assigned to the current user", () => {
    const upcomingRoute = read("src/app/api/tasks/upcoming/route.ts");

    expect(upcomingRoute).toContain("assignees:");
    expect(upcomingRoute).toContain("profileId: user.id");
    expect(upcomingRoute).toContain("archived: false");
    expect(upcomingRoute).toContain("dueDate:");
  });

  it("uses assigneeIds and assignees in client contracts", () => {
    const hooks = read("src/hooks/use-tasks.ts");
    const kanban = read("src/hooks/use-kanban.ts");
    const form = read("src/components/kanban/task-form.tsx");

    expect(hooks).toContain("assigneeIds");
    expect(kanban).toContain("assignees:");
    expect(form).toContain("MultiPersonSelector");
  });
});
