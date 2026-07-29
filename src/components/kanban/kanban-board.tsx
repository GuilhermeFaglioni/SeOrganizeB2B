"use client";

import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useState } from "react";
import { KanbanColumn } from "./kanban-column";
import { KanbanCard } from "./kanban-card";
import { useMoveTask, type BoardColumn, type BoardTask } from "@/hooks/use-kanban";

export function KanbanBoard({
  columns,
  projectId,
  selectedTaskId,
  onTaskClick,
  onAddClick,
  areaFilter,
}: {
  columns: BoardColumn[];
  projectId: string;
  selectedTaskId?: string;
  onTaskClick?: (taskId: string) => void;
  onAddClick?: (columnId: string) => void;
  areaFilter?: string | null;
}) {
  const [activeTask, setActiveTask] = useState<BoardTask | null>(null);
  const moveTask = useMoveTask(projectId);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const allTasks = columns.flatMap((col) => col.tasks);

  function handleDragStart(event: DragStartEvent) {
    const task = allTasks.find((t) => t.id === event.active.id);
    if (task) setActiveTask(task);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeTaskData = allTasks.find((t) => t.id === active.id);
    if (!activeTaskData) return;

    const sourceColumn = columns.find((col) =>
      col.tasks.some((t) => t.id === active.id)
    );
    const overIsColumn = columns.some((col) => col.id === over.id);
    const targetColumnId = overIsColumn
      ? (over.id as string)
      : columns.find((col) => col.tasks.some((t) => t.id === over.id))?.id;

    if (!sourceColumn || !targetColumnId) return;

    const targetColumn = columns.find((col) => col.id === targetColumnId);
    if (!targetColumn) return;

    const areaIds = areaFilter?.split(",").filter(Boolean) || [];
    const filteredTasks = areaIds.length > 0
      ? targetColumn.tasks.filter((t) => t.area?.id && areaIds.includes(t.area.id))
      : targetColumn.tasks;

    const overIndex = filteredTasks.findIndex((t) => t.id === over.id);
    const beforePosition = overIndex > 0 ? filteredTasks[overIndex - 1].position : null;
    const afterPosition = overIndex < filteredTasks.length ? filteredTasks[overIndex].position : null;

    moveTask.mutate({
      taskId: active.id as string,
      targetColumnId,
      beforePosition,
      afterPosition,
    });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div
        data-testid="kanban-board"
        className="flex gap-4 overflow-x-auto pb-4 h-full snap-x snap-mandatory"
        role="list"
        aria-label="Kanban board"
      >
        {columns.map((column) => (
          <KanbanColumn
            key={column.id}
            column={column}
            selectedTaskId={selectedTaskId}
            onTaskClick={onTaskClick}
            onAddClick={() => onAddClick?.(column.id)}
            areaFilter={areaFilter}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask ? (
          <KanbanCard task={activeTask} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
