"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { KanbanCard } from "./kanban-card";
import type { BoardColumn } from "@/hooks/use-kanban";

export function KanbanColumn({
  column,
  selectedTaskId,
  onTaskClick,
  onAddClick,
  areaFilter,
}: {
  column: BoardColumn;
  selectedTaskId?: string;
  onTaskClick?: (taskId: string) => void;
  onAddClick?: () => void;
  areaFilter?: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  const areaIds = areaFilter?.split(",").filter(Boolean) || [];
  const filteredTasks = areaIds.length > 0
    ? column.tasks.filter((t) => t.area?.id && areaIds.includes(t.area.id))
    : column.tasks;

  return (
    <div
      data-testid={`kanban-column-${column.name}`}
      className="flex-shrink-0 w-[280px] min-w-[260px] flex flex-col gap-4 snap-start"
      role="region"
      aria-label={`Column: ${column.name}`}
    >
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <h3 className="text-label font-semibold text-text-primary">{column.name}</h3>
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-bg-tertiary text-caption text-text-secondary">
            {filteredTasks.length}
          </span>
        </div>
        <button
          onClick={onAddClick}
          className="text-text-secondary hover:text-text-primary transition-colors"
          aria-label={`Add task to ${column.name}`}
        >
          <Plus size={16} />
        </button>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex flex-col gap-[10px] min-h-[60px] rounded-lg p-2 transition-colors",
          isOver ? "bg-accent/10" : "bg-bg-secondary/50"
        )}
      >
        <SortableContext items={filteredTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {filteredTasks.map((task) => (
            <KanbanCard
              key={task.id}
              task={task}
              isSelected={task.id === selectedTaskId}
              onClick={() => onTaskClick?.(task.id)}
            />
          ))}
        </SortableContext>
        {filteredTasks.length === 0 && (
          <div className="text-caption text-text-secondary text-center py-4">
            {areaFilter ? "No tasks for this area" : "No tasks yet"}
          </div>
        )}
      </div>
    </div>
  );
}
