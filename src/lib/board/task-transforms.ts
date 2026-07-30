import type { BoardTask } from "@/hooks/use-kanban";

export type BoardSort = "manual" | "priority" | "dueDate" | "title";
export type BoardGroupBy = "workflow" | "assignee" | "area";

export interface BoardTaskFilters {
  assigneeId?: string | null;
  areaIds?: string[];
  dateFrom?: string | null;
  dateTo?: string | null;
  temporal?: string | null;
  currentUserId?: string | null;
}

function dayStart(value: string) {
  return new Date(`${value}T00:00:00`).getTime();
}

function dayEnd(value: string) {
  return new Date(`${value}T23:59:59.999`).getTime();
}

export function filterBoardTasks(
  tasks: BoardTask[],
  filters: BoardTaskFilters
): BoardTask[] {
  return tasks.filter((task) => {
    if (
      filters.assigneeId &&
      !task.assignees.some(
        (assignment) => assignment.profileId === filters.assigneeId
      )
    ) {
      return false;
    }
    if (
      filters.areaIds?.length &&
      (!task.area?.id || !filters.areaIds.includes(task.area.id))
    ) {
      return false;
    }
    if (filters.dateFrom) {
      if (!task.dueDate || new Date(task.dueDate).getTime() < dayStart(filters.dateFrom)) {
        return false;
      }
    }
    if (filters.dateTo) {
      if (!task.dueDate || new Date(task.dueDate).getTime() > dayEnd(filters.dateTo)) {
        return false;
      }
    }
    if (filters.temporal === "overdue") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (!task.dueDate || new Date(task.dueDate) >= today) return false;
    }
    if (filters.temporal === "this-week") {
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      if (
        !task.dueDate ||
        new Date(task.dueDate) < weekStart ||
        new Date(task.dueDate) > weekEnd
      ) {
        return false;
      }
    }
    if (
      filters.temporal === "my-tasks" &&
      (!filters.currentUserId ||
        !task.assignees.some(
          (assignment) =>
            assignment.profileId === filters.currentUserId
        ))
    ) {
      return false;
    }
    return true;
  });
}

const PRIORITY_RANK: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function sortBoardTasks(
  tasks: BoardTask[],
  sort: BoardSort
): BoardTask[] {
  return tasks
    .map((task, index) => ({ task, index }))
    .sort((a, b) => {
      let comparison = 0;
      if (sort === "priority") {
        comparison =
          (PRIORITY_RANK[a.task.priority] ?? 99) -
          (PRIORITY_RANK[b.task.priority] ?? 99);
      } else if (sort === "dueDate") {
        comparison =
          (a.task.dueDate
            ? new Date(a.task.dueDate).getTime()
            : Number.POSITIVE_INFINITY) -
          (b.task.dueDate
            ? new Date(b.task.dueDate).getTime()
            : Number.POSITIVE_INFINITY);
      } else if (sort === "title") {
        comparison = a.task.title.localeCompare(b.task.title, "pt-BR");
      } else {
        comparison = a.task.position - b.task.position;
      }
      return comparison || a.index - b.index;
    })
    .map(({ task }) => task);
}

export function groupBoardTasks(
  tasks: BoardTask[],
  groupBy: BoardGroupBy
): Array<{ key: string; label: string; tasks: BoardTask[] }> {
  if (groupBy === "workflow") {
    return [{ key: "workflow", label: "", tasks }];
  }
  const groups = new Map<string, { label: string; tasks: BoardTask[] }>();
  for (const task of tasks) {
    const primary = task.assignees[0]?.profile;
    const key =
      groupBy === "assignee"
        ? primary?.id || "__unassigned__"
        : task.area?.id || "__no_area__";
    const label =
      groupBy === "assignee"
        ? primary?.name || primary?.email || "Sem responsável"
        : task.area?.name || "Sem team area";
    const current = groups.get(key) || { label, tasks: [] };
    current.tasks.push(task);
    groups.set(key, current);
  }
  return Array.from(groups, ([key, value]) => ({ key, ...value }));
}
