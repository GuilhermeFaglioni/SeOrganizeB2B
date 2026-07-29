import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function read(filename: string): string {
  return readFileSync(resolve(__dirname, "../..", filename), "utf-8");
}

function exists(filename: string): boolean {
  return existsSync(resolve(__dirname, "../..", filename));
}

describe("1.5.1 Task API routes", () => {
  it("POST /api/projects/[projectId]/tasks route exists with CRUD", () => {
    expect(exists("src/app/api/projects/[projectId]/tasks/route.ts")).toBe(true);
    const src = read("src/app/api/projects/[projectId]/tasks/route.ts");
    expect(src).toContain("export async function GET");
    expect(src).toContain("export async function POST");
    expect(src).toContain("getSession");
    expect(src).toContain("prisma.task");
    expect(src).toContain("position");
  });

  it("PATCH/DELETE /api/tasks/[id]/route.ts exists", () => {
    expect(exists("src/app/api/tasks/[id]/route.ts")).toBe(true);
    const src = read("src/app/api/tasks/[id]/route.ts");
    expect(src).toContain("export async function PATCH");
    expect(src).toContain("export async function DELETE");
    expect(src).toContain("params.id");
  });

  it("PUT /api/tasks/reorder route does NOT conflict with [id] (moved to /api/reorder/tasks)", () => {
    expect(exists("src/app/api/tasks/reorder/route.ts")).toBe(false);
    expect(exists("src/app/api/reorder/tasks/route.ts")).toBe(true);
    const src = read("src/app/api/reorder/tasks/route.ts");
    expect(src).toContain("export async function PUT");
    expect(src).toContain("position");
    expect(src).toContain("column_id");
  });
});

describe("1.5.1b Route naming consistency", () => {
  it("all project routes use [projectId] segment, not [id]", () => {
    expect(exists("src/app/api/projects/[id]/route.ts")).toBe(false);
    expect(exists("src/app/api/projects/[projectId]/route.ts")).toBe(true);
    const src = read("src/app/api/projects/[projectId]/route.ts");
    expect(src).toContain("params.projectId");
  });
});

describe("1.5.2 Column API routes", () => {
  it("GET/POST /api/projects/[projectId]/columns/route.ts exists", () => {
    expect(exists("src/app/api/projects/[projectId]/columns/route.ts")).toBe(true);
    const src = read("src/app/api/projects/[projectId]/columns/route.ts");
    expect(src).toContain("export async function GET");
    expect(src).toContain("export async function POST");
    expect(src).toContain("includeTasks");
  });

  it("PATCH/DELETE /api/projects/[projectId]/columns/[columnId]/route.ts exists", () => {
    expect(exists("src/app/api/projects/[projectId]/columns/[columnId]/route.ts")).toBe(true);
    const src = read("src/app/api/projects/[projectId]/columns/[columnId]/route.ts");
    expect(src).toContain("export async function PATCH");
    expect(src).toContain("export async function DELETE");
    expect(src).toContain("409");
  });

  it("PUT /api/projects/[projectId]/columns/reorder/route.ts exists", () => {
    expect(exists("src/app/api/projects/[projectId]/columns/reorder/route.ts")).toBe(true);
    const src = read("src/app/api/projects/[projectId]/columns/reorder/route.ts");
    expect(src).toContain("export async function PUT");
    expect(src).toContain("orderedIds");
  });
});

describe("1.5.3 reorder utility", () => {
  it("src/lib/reorder.ts exports getInsertPosition and reindexColumns", () => {
    expect(exists("src/lib/reorder.ts")).toBe(true);
    const src = read("src/lib/reorder.ts");
    expect(src).toContain("getInsertPosition");
    expect(src).toContain("reindexColumns");
  });
});

describe("1.5.4 useKanban hook", () => {
  it("exports useBoard, useColumns, useMoveTask", () => {
    const src = read("src/hooks/use-kanban.ts");
    expect(src).toMatch(/useBoard/);
    expect(src).toMatch(/useColumns/);
    expect(src).toMatch(/useMoveTask/);
    expect(src).toContain("@tanstack/react-query");
    expect(src).toContain("onMutate");
  });
});

describe("1.5.5 useTasks hook", () => {
  it("exports useTasks, useTask, useCreateTask, useUpdateTask, useDeleteTask", () => {
    const src = read("src/hooks/use-tasks.ts");
    expect(src).toMatch(/useTasks/);
    expect(src).toMatch(/useTask/);
    expect(src).toMatch(/useCreateTask/);
    expect(src).toMatch(/useUpdateTask/);
    expect(src).toMatch(/useDeleteTask/);
    expect(src).toContain("invalidateQueries");
    expect(src).toContain("board");
  });
});

describe("1.5.6 KanbanCard component", () => {
  it("renders title, priority badge, due date, area badge, comment count", () => {
    const src = read("src/components/kanban/kanban-card.tsx");
    expect(src).toContain("task-card-");
    expect(src).toContain("useSortable");
    expect(src).toContain("border-danger");
    expect(src).toContain("priority");
    expect(src).toContain("dueDate");
    expect(src).toContain("MessageSquare");
  });
});

describe("1.5.7 KanbanColumn component", () => {
  it("renders column header, count badge, add button, droppable list", () => {
    const src = read("src/components/kanban/kanban-column.tsx");
    expect(src).toContain("kanban-column-");
    expect(src).toContain("useDroppable");
    expect(src).toContain("Plus");
    expect(src).toContain("KanbanCard");
  });

  it("areaFilter splits comma-separated string and uses .includes()", () => {
    const src = read("src/components/kanban/kanban-column.tsx");
    expect(src).toContain(".split");
    expect(src).toContain(".includes");
    expect(src).not.toContain("=== areaFilter");
  });
});

describe("1.5.9 TaskForm component", () => {
  it("renders modal with title, description, assignee, area, priority, due date", () => {
    const src = read("src/components/kanban/task-form.tsx");
    expect(src).toContain("Dialog");
    expect(src).toContain("title");
    expect(src).toContain("description");
    expect(src).toContain("priority");
    expect(src).toContain("dueDate");
    expect(src).toContain("useCreateTask");
    expect(src).toContain("useUpdateTask");
  });
});

describe("1.5.10 TaskDetailPanel component", () => {
  it("renders 400px panel with task fields and comments", () => {
    const src = read("src/components/kanban/task-detail-panel.tsx");
    expect(src).toContain('data-testid="task-detail-panel"');
    expect(src).toContain("400px");
    expect(src).toContain("comments");
  });
});

describe("1.5.8 KanbanBoard component", () => {
  it("renders DndContext with DragOverlay and KanbanColumn", () => {
    const src = read("src/components/kanban/kanban-board.tsx");
    expect(src).toContain('data-testid="kanban-board"');
    expect(src).toContain("DndContext");
    expect(src).toContain("DragOverlay");
    expect(src).toContain("KanbanColumn");
    expect(src).toContain("useMoveTask");
  });
});

describe("1.5.12 Board page", () => {
  it("renders kanban board page with useBoard hook", () => {
    expect(exists("src/app/(authenticated)/board/[projectId]/page.tsx")).toBe(true);
    const src = read("src/app/(authenticated)/board/[projectId]/page.tsx");
    expect(src).toContain("KanbanBoard");
    expect(src).toContain("useBoard");
  });

  it("reads areaFilter from searchParams and passes to KanbanBoard", () => {
    const src = read("src/app/(authenticated)/board/[projectId]/page.tsx");
    expect(src).toContain("useSearchParams");
    expect(src).toContain("areaFilter");
    expect(src).toContain("KanbanBoard");
  });
});

describe("Sidebar areaFilter wiring", () => {
  it("sidebar.tsx reads/writes area filter via URL searchParams", () => {
    const src = read("src/components/layout/sidebar.tsx");
    expect(src).toContain("useSearchParams");
    expect(src).toContain("useRouter");
    expect(src).toContain("areas");
  });
});

describe("1.5.13 Realtime integration", () => {
  it("src/lib/supabase/realtime.ts exports subscribeToBoard", () => {
    expect(exists("src/lib/supabase/realtime.ts")).toBe(true);
    const src = read("src/lib/supabase/realtime.ts");
    expect(src).toContain("subscribeToBoard");
    expect(src).toContain("postgres_changes");
    expect(src).toContain("tasks");
  });
});
