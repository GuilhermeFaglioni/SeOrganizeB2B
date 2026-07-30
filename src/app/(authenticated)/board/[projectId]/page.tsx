"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/stores/auth-context";
import { useBoard, type BoardTask } from "@/hooks/use-kanban";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { TaskForm } from "@/components/kanban/task-form";
import { TaskDetailPanel } from "@/components/kanban/task-detail-panel";
import { LoadingState } from "@/components/shared/loading-state";
import { useDeleteTask, useUpdateTask } from "@/hooks/use-tasks";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function BoardPage() {
  const params = useParams<{ projectId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const projectId = params.projectId;
  const areaFilter = searchParams.get("areas") || null;
  const activeFilter = searchParams.get("filter") || null;
  const { data: columns, isLoading } = useBoard(projectId);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [addToColumnId, setAddToColumnId] = useState<string | null>(null);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<BoardTask | null>(null);

  const deleteTask = useDeleteTask(projectId);
  const updateTask = useUpdateTask(projectId);

  useEffect(() => {
    if (searchParams.get("newTask") === "true" && columns && columns.length > 0) {
      setAddToColumnId(columns[0].id);
      setTaskFormOpen(true);
      const params = new URLSearchParams(searchParams.toString());
      params.delete("newTask");
      router.replace(`/board/${projectId}?${params.toString()}`);
    }
  }, [searchParams, columns, projectId, router]);

  function setFilter(filter: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (filter) {
      params.set("filter", filter);
    } else {
      params.delete("filter");
    }
    router.replace(`/board/${projectId}?${params.toString()}`);
  }

  if (isLoading) {
    return <LoadingState />;
  }

  const allTasks: BoardTask[] = columns ? columns.flatMap((col) => col.tasks) : [];
  const selectedTask: BoardTask | undefined = selectedTaskId
    ? allTasks.find((t) => t.id === selectedTaskId)
    : undefined;

  const handleDeleteTask = () => {
    if (selectedTaskId) {
      deleteTask.mutate(selectedTaskId);
      setSelectedTaskId(null);
      setDeleteConfirmOpen(false);
    }
  };

  const handleArchiveTask = () => {
    if (selectedTaskId) {
      updateTask.mutate({ id: selectedTaskId, archived: true });
      setSelectedTaskId(null);
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

  const filterButtons = [
    { key: null, label: "All" },
    { key: "overdue", label: "Overdue" },
    { key: "this-week", label: "This Week" },
    { key: "my-tasks", label: "My Tasks" },
  ];

  return (
    <div className="flex h-full">
      <div className="flex-1 p-4 overflow-hidden flex flex-col">
        <div className="flex items-center gap-2 mb-3 shrink-0">
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
        <div className="flex-1 overflow-hidden">
          {columns && (
            <KanbanBoard
              columns={columns}
              projectId={projectId}
              selectedTaskId={selectedTaskId || undefined}
              onTaskClick={setSelectedTaskId}
              onAddClick={handleAddClick}
              areaFilter={areaFilter}
              taskFilter={activeFilter ? (task) => {
                if (activeFilter === "overdue") {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  return task.dueDate ? new Date(task.dueDate) < today : false;
                }
                if (activeFilter === "this-week") {
                  const now = new Date();
                  const weekStart = new Date(now);
                  weekStart.setDate(now.getDate() - now.getDay());
                  weekStart.setHours(0, 0, 0, 0);
                  const weekEnd = new Date(weekStart);
                  weekEnd.setDate(weekStart.getDate() + 6);
                  weekEnd.setHours(23, 59, 59, 999);
                  return task.dueDate ? new Date(task.dueDate) >= weekStart && new Date(task.dueDate) <= weekEnd : false;
                }
                if (activeFilter === "my-tasks") {
                  return task.assignees.some(
                    (assignment) => assignment.profileId === user?.id,
                  );
                }
                return true;
              } : undefined}
            />
          )}
        </div>
      </div>
      {selectedTask && (
        <>
          <TaskDetailPanel
            task={selectedTask}
            onClose={() => setSelectedTaskId(null)}
            onDelete={() => setDeleteConfirmOpen(true)}
            onEdit={() => {
              setEditingTask(selectedTask);
              setTaskFormOpen(true);
            }}
            onArchive={handleArchiveTask}
          />
          <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Task</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete &ldquo;{selectedTask.title}&rdquo;? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
                <Button variant="destructive" onClick={handleDeleteTask}>Delete</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
      {(addToColumnId || editingTask) && (
        <TaskForm
          open={taskFormOpen}
          onOpenChange={(open) => {
            handleTaskFormClose();
            if (!open) setEditingTask(null);
          }}
          projectId={projectId}
          columnId={editingTask?.columnId || addToColumnId || ""}
          task={editingTask}
        />
      )}
    </div>
  );
}
