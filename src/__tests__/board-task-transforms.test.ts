import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import {
  filterBoardTasks,
  groupBoardTasks,
  sortBoardTasks,
} from "../lib/board/task-transforms";
import type { BoardTask } from "../hooks/use-kanban";

const helperPath = resolve(
  __dirname,
  "../lib/board/task-transforms.ts"
);

describe("Board task transformations", () => {
  it("defines isolated filtering, stable sorting and grouping helpers", () => {
    expect(existsSync(helperPath)).toBe(true);
    const source = readFileSync(helperPath, "utf8");
    expect(source).toContain("export function filterBoardTasks");
    expect(source).toContain("export function sortBoardTasks");
    expect(source).toContain("export function groupBoardTasks");
  });

  const task = (
    id: string,
    overrides: Partial<BoardTask> = {}
  ): BoardTask => ({
    id,
    title: id,
    priority: "medium",
    dueDate: null,
    position: 1024,
    area: null,
    assignees: [],
    _count: { comments: 0 },
    ...overrides,
  });

  it("composes assignee, area and inclusive due-date filters", () => {
    const matching = task("matching", {
      dueDate: "2026-07-30T20:00:00.000Z",
      area: { id: "area-1", name: "Ops", color: "#000" },
      assignees: [
        {
          profileId: "person-1",
          profile: {
            id: "person-1",
            name: "Ana",
            email: "ana@example.com",
            avatarUrl: null,
          },
        },
      ],
    });
    expect(
      filterBoardTasks([matching, task("other")], {
        assigneeId: "person-1",
        areaIds: ["area-1"],
        dateFrom: "2026-07-30",
        dateTo: "2026-07-30",
      }).map((item) => item.id)
    ).toEqual(["matching"]);
  });

  it("sorts priority stably and groups by primary assignee", () => {
    const ana = {
      profileId: "person-1",
      profile: {
        id: "person-1",
        name: "Ana",
        email: "ana@example.com",
        avatarUrl: null,
      },
    };
    const tasks = [
      task("medium-a", { priority: "medium", assignees: [ana] }),
      task("urgent", { priority: "urgent" }),
      task("medium-b", { priority: "medium", assignees: [ana] }),
    ];
    expect(sortBoardTasks(tasks, "priority").map((item) => item.id)).toEqual([
      "urgent",
      "medium-a",
      "medium-b",
    ]);
    expect(groupBoardTasks(tasks, "assignee")).toEqual([
      {
        key: "person-1",
        label: "Ana",
        tasks: [tasks[0], tasks[2]],
      },
      {
        key: "__unassigned__",
        label: "Sem responsável",
        tasks: [tasks[1]],
      },
    ]);
  });
});
