"use client";

import { useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useBoard, type BoardTask } from "@/hooks/use-kanban";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { TaskForm } from "@/components/kanban/task-form";
import { TaskDetailPanel } from "@/components/kanban/task-detail-panel";
import { LoadingState } from "@/components/shared/loading-state";

export default function BoardPage() {
  const params = useParams<{ projectId: string }>();
  const searchParams = useSearchParams();
  const projectId = params.projectId;
  const areaFilter = searchParams.get("areas") || null;
  const { data: columns, isLoading } = useBoard(projectId);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [addToColumnId, setAddToColumnId] = useState<string | null>(null);
  const [taskFormOpen, setTaskFormOpen] = useState(false);

  if (isLoading) {
    return <LoadingState />;
  }

  const allTasks: BoardTask[] = columns ? columns.flatMap((col) => col.tasks) : [];
  const selectedTask: BoardTask | undefined = selectedTaskId
    ? allTasks.find((t) => t.id === selectedTaskId)
    : undefined;

  function handleAddClick(columnId: string) {
    setAddToColumnId(columnId);
    setTaskFormOpen(true);
  }

  function handleTaskFormClose() {
    setTaskFormOpen(false);
    setAddToColumnId(null);
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 p-4 overflow-hidden">
        {columns && (
          <KanbanBoard
            columns={columns}
            projectId={projectId}
            selectedTaskId={selectedTaskId || undefined}
            onTaskClick={setSelectedTaskId}
            onAddClick={handleAddClick}
            areaFilter={areaFilter}
          />
        )}
      </div>
      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          onClose={() => setSelectedTaskId(null)}
        />
      )}
      {addToColumnId && (
        <TaskForm
          open={taskFormOpen}
          onOpenChange={handleTaskFormClose}
          projectId={projectId}
          columnId={addToColumnId}
        />
      )}
    </div>
  );
}
