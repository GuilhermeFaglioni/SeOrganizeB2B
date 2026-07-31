"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/stores/auth-context";
import { useBoard, type BoardTask } from "@/hooks/use-kanban";
import { useProjects } from "@/hooks/use-projects";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { TaskForm } from "@/components/kanban/task-form";
import { TaskDetailPanel } from "@/components/kanban/task-detail-panel";
import { LoadingState } from "@/components/shared/loading-state";
import { useDeleteTask, useUpdateTask } from "@/hooks/use-tasks";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LayoutDashboard } from "lucide-react";
import { SavedViewControl } from "@/components/board/saved-view-control";
import type { BoardViewFilters } from "@/hooks/use-saved-views";
import {
  BoardControls,
  type BoardControlValues,
} from "@/components/board/board-controls";
import {
  filterBoardTasks,
  sortBoardTasks,
  type BoardGroupBy,
  type BoardSort,
} from "@/lib/board/task-transforms";

const ALL_VALUE = "__all__";

interface SelectedTaskInfo {
  task: BoardTask;
  projectName?: string;
}

export default function BoardPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const { data: projects } = useProjects();
  const areaFilter = searchParams.get("areas") || null;
  const activeFilter = searchParams.get("filter") || null;
  const assigneeFilter = searchParams.get("assignee") || null;
  const dateFrom = searchParams.get("dateFrom") || null;
  const dateTo = searchParams.get("dateTo") || null;
  const sortParam = searchParams.get("sort");
  const groupParam = searchParams.get("group");
  const sort: BoardSort = ["priority", "dueDate", "title"].includes(
    sortParam || ""
  )
    ? (sortParam as BoardSort)
    : "manual";
  const groupBy: BoardGroupBy = ["assignee", "area"].includes(groupParam || "")
    ? (groupParam as BoardGroupBy)
    : "workflow";
  const projectParam = searchParams.get("project") || null;
  const [selectedProjectId, setSelectedProjectId] = useState(
    projectParam || ALL_VALUE
  );
  const isAll = selectedProjectId === ALL_VALUE;
  const { data: columns } = useBoard(isAll ? "_" : (selectedProjectId || "_"));
  const [selectedTaskInfo, setSelectedTaskInfo] = useState<SelectedTaskInfo | null>(null);
  const [addToColumnId, setAddToColumnId] = useState<string | null>(null);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<BoardTask | null>(null);

  const deleteTask = useDeleteTask(isAll ? "_" : (selectedProjectId || "_"));
  const updateTask = useUpdateTask(isAll ? "_" : (selectedProjectId || "_"));

  useEffect(() => {
    setSelectedProjectId(projectParam || ALL_VALUE);
  }, [projectParam]);

  useEffect(() => {
    if (searchParams.get("newTask") === "true" && columns && columns.length > 0) {
      setAddToColumnId(columns[0].id);
      setTaskFormOpen(true);
      const params = new URLSearchParams(searchParams.toString());
      params.delete("newTask");
      router.replace(`/board?${params.toString()}`);
    }
  }, [searchParams, columns, router]);

  function setFilter(filter: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (filter) {
      params.set("filter", filter);
    } else {
      params.delete("filter");
    }
    router.replace(`/board?${params.toString()}`);
  }

  function applySavedView(filters: BoardViewFilters) {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of [
      "project",
      "areas",
      "filter",
      "assignee",
      "dateFrom",
      "dateTo",
      "sort",
      "group",
    ]) {
      params.delete(key);
    }
    if (filters.project && filters.project !== ALL_VALUE) {
      params.set("project", filters.project);
    }
    if (filters.areas) params.set("areas", filters.areas);
    if (filters.filter) params.set("filter", filters.filter);
    if (filters.assignee) params.set("assignee", filters.assignee);
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.set("dateTo", filters.dateTo);
    if (filters.sort && filters.sort !== "manual") {
      params.set("sort", filters.sort);
    }
    if (filters.group && filters.group !== "workflow") {
      params.set("group", filters.group);
    }
    router.replace(`/board?${params.toString()}`);
  }

  function setBoardControl(
    key: keyof BoardControlValues,
    value: string | null
  ) {
    const params = new URLSearchParams(searchParams.toString());
    const isDefault =
      value === null ||
      (key === "sort" && value === "manual") ||
      (key === "group" && value === "workflow");
    if (isDefault) params.delete(key);
    else params.set(key, value);
    router.replace(`/board?${params.toString()}`);
  }

  function clearBoardControls() {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of [
      "assignee",
      "areas",
      "dateFrom",
      "dateTo",
      "sort",
      "group",
    ]) {
      params.delete(key);
    }
    router.replace(`/board?${params.toString()}`);
  }

  function handleProjectChange(id: string) {
    setSelectedProjectId(id);
    setSelectedTaskInfo(null);
    const params = new URLSearchParams(searchParams.toString());
    if (id && id !== ALL_VALUE) {
      params.set("project", id);
    } else {
      params.delete("project");
    }
    router.replace(`/board?${params.toString()}`);
  }

  const handleTaskClick = useCallback((task: BoardTask, projectName?: string) => {
    setSelectedTaskInfo({ task, projectName });
  }, []);

  const handleDeleteTask = () => {
    if (selectedTaskInfo) {
      deleteTask.mutate(selectedTaskInfo.task.id);
      setSelectedTaskInfo(null);
      setDeleteConfirmOpen(false);
    }
  };

  const handleArchiveTask = () => {
    if (selectedTaskInfo) {
      updateTask.mutate({ id: selectedTaskInfo.task.id, archived: true });
      setSelectedTaskInfo(null);
    }
  };

  function handleAddClick(columnId: string) {
    setAddToColumnId(columnId);
    setTaskFormOpen(true);
  }

  function handleTaskFormClose() {
    setTaskFormOpen(false);
    setAddToColumnId(null);
    setEditingTask(null);
  }

  function matchesFilter(task: BoardTask): boolean {
    return (
      filterBoardTasks([task], {
        assigneeId: assigneeFilter,
        areaIds: areaFilter?.split(",").filter(Boolean) || [],
        dateFrom,
        dateTo,
        temporal: activeFilter,
        currentUserId: user?.id,
      }).length === 1
    );
  }

  const preparedColumns = columns?.map((column) => ({
    ...column,
    tasks: sortBoardTasks(column.tasks.filter(matchesFilter), sort),
  }));

  const filterButtons = [
    { key: null, label: "All" },
    { key: "overdue", label: "Overdue" },
    { key: "this-week", label: "This Week" },
    { key: "my-tasks", label: "My Tasks" },
  ];

  return (
    <div className="flex h-full">
      <div className="flex-1 p-4 overflow-y-auto flex flex-col">
        <div className="mb-3 shrink-0 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
          <div className="w-48">
            <Select
              value={selectedProjectId || ""}
              onValueChange={handleProjectChange}
            >
              <SelectTrigger className="bg-page-alt">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>All Projects</SelectItem>
                {projects?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
           <div className="flex items-center gap-2">
            {filterButtons.map((f) => (
              <button
                key={f.key || "all"}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "px-3 py-1.5 text-sm rounded-md transition-colors",
                  activeFilter === f.key || (!activeFilter && !f.key)
                    ? "bg-accent text-white"
                    : "bg-bg-secondary text-text-secondary hover:bg-bg-tertiary"
                )}
              >
                {f.label}
              </button>
            ))}
           </div>
           <SavedViewControl
             filters={{
               project: selectedProjectId,
               areas: areaFilter,
               filter: activeFilter,
               assignee: assigneeFilter,
               dateFrom,
               dateTo,
               sort,
               group: groupBy,
             }}
             onApply={applySavedView}
           />
          </div>
          <BoardControls
            values={{
              assignee: assigneeFilter,
              areas: areaFilter,
              dateFrom,
              dateTo,
              sort,
              group: groupBy,
            }}
            onChange={setBoardControl}
            onClear={clearBoardControls}
          />
        </div>
        <div className="flex-1 min-h-0">
          {isAll ? (
            <AllProjectsView
              matchesFilter={matchesFilter}
              sort={sort}
              groupBy={groupBy}
              onTaskClick={handleTaskClick}
            />
          ) : selectedProjectId && preparedColumns ? (
            <KanbanBoard
              columns={preparedColumns}
              projectId={selectedProjectId}
              selectedTaskId={selectedTaskInfo?.task.id || undefined}
              onTaskClick={(taskId: string) => {
                const task = preparedColumns.flatMap((c) => c.tasks).find((t) => t.id === taskId);
                if (task) handleTaskClick(task);
              }}
              onAddClick={handleAddClick}
              groupBy={groupBy}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-text-secondary">
              Select a project to view its board
            </div>
          )}
        </div>
      </div>
      {selectedTaskInfo && (
        <TaskDetailPanel
          task={selectedTaskInfo.task}
          onClose={() => setSelectedTaskInfo(null)}
          onDelete={!isAll ? () => setDeleteConfirmOpen(true) : undefined}
          onEdit={!isAll ? () => {
            setEditingTask(selectedTaskInfo.task);
            setTaskFormOpen(true);
          } : undefined}
          onArchive={!isAll ? handleArchiveTask : undefined}
        />
      )}
      {selectedTaskInfo && !isAll && (
        <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Task</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete &ldquo;{selectedTaskInfo.task.title}&rdquo;? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDeleteTask}>Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {(addToColumnId || editingTask) && selectedProjectId && !isAll && (
        <TaskForm
          open={taskFormOpen}
          onOpenChange={(open) => {
            handleTaskFormClose();
            if (!open) setEditingTask(null);
          }}
          projectId={selectedProjectId}
          columnId={editingTask?.columnId || addToColumnId || ""}
          task={editingTask}
        />
      )}
    </div>
  );
}

function AllProjectsView({
  matchesFilter,
  sort,
  groupBy,
  onTaskClick,
}: {
  matchesFilter: (task: BoardTask) => boolean;
  sort: BoardSort;
  groupBy: BoardGroupBy;
  onTaskClick: (task: BoardTask, projectName?: string) => void;
}) {
  const { data: projects } = useProjects();
  if (!projects) return <LoadingState />;

  return (
    <div className="space-y-6 overflow-y-auto h-full pb-8">
      {projects.map((project) => (
        <ProjectBoardSection
          key={project.id}
          projectId={project.id}
          projectName={project.name}
          matchesFilter={matchesFilter}
          sort={sort}
          groupBy={groupBy}
          onTaskClick={onTaskClick}
        />
      ))}
    </div>
  );
}

function ProjectBoardSection({
  projectId,
  projectName,
  matchesFilter,
  sort,
  groupBy,
  onTaskClick,
}: {
  projectId: string;
  projectName: string;
  matchesFilter: (task: BoardTask) => boolean;
  sort: BoardSort;
  groupBy: BoardGroupBy;
  onTaskClick: (task: BoardTask, projectName?: string) => void;
}) {
  const { data: columns } = useBoard(projectId);
  const router = useRouter();

  if (!columns) return null;

  const filteredColumns = columns.map((col) => ({
    ...col,
    tasks: sortBoardTasks(col.tasks.filter(matchesFilter), sort),
  }));

  const taskCount = filteredColumns.reduce((sum, col) => sum + col.tasks.length, 0);
  if (taskCount === 0) return null;

  return (
    <div className="bg-page-alt border border-border rounded-xl p-5">
      <button
        onClick={() => router.push(`/board/${projectId}`)}
        className="flex items-center gap-2 text-base font-semibold text-text-primary hover:text-accent mb-4"
      >
        <LayoutDashboard size={18} />
        {projectName}
        <span className="text-sm font-normal text-text-secondary">({taskCount} tasks)</span>
      </button>
       <div className="h-[250px] min-h-0">
         <KanbanBoard
           columns={filteredColumns}
           projectId={projectId}
           mode="compact"
           projectName={projectName}
           allowColumnManagement={false}
           groupBy={groupBy}
           onTaskClick={(taskId) => {
             const task = filteredColumns
               .flatMap((column) => column.tasks)
               .find((item) => item.id === taskId);
             if (task) onTaskClick(task, projectName);
           }}
         />
       </div>
    </div>
  );
}
