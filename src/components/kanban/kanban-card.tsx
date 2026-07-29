"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarDays, MessageSquare, GripVertical } from "lucide-react";
import { PRIORITY_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { AreaBadge } from "@/components/areas/area-badge";
import type { BoardTask } from "@/hooks/use-kanban";

export function KanbanCard({
  task,
  isSelected,
  onClick,
}: {
  task: BoardTask;
  isSelected?: boolean;
  onClick?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priorityColor = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium;
  const isOverdue =
    task.dueDate && new Date(task.dueDate) < new Date(new Date().toDateString());

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid={`task-card-${task.id}`}
      className={cn(
        "bg-white border rounded-lg shadow-sm p-[10px] cursor-pointer hover:shadow-md transition-shadow",
        isOverdue && "border-danger",
        isSelected && "border-[2px] border-accent",
        isDragging && "opacity-50"
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1">
          <button {...attributes} {...listeners} className="touch-none text-text-secondary hover:text-text-primary cursor-grab active:cursor-grabbing">
            <GripVertical size={14} />
          </button>
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium"
            style={{ color: priorityColor.text, backgroundColor: priorityColor.bg }}
          >
            {task.priority}
          </span>
        </div>
        {task.dueDate && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-[10px]",
              isOverdue ? "text-danger" : "text-text-secondary"
            )}
          >
            <CalendarDays size={10} />
            {new Date(task.dueDate).toLocaleDateString()}
          </span>
        )}
      </div>
      <p className="text-[14px] font-medium text-text-primary leading-tight line-clamp-2 mb-2">
        {task.title}
      </p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {task.area && (
            <AreaBadge name={task.area.name} color={task.area.color} compact />
          )}
        </div>
        {task._count.comments > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[10px] text-text-secondary">
            <MessageSquare size={10} />
            {task._count.comments}
          </span>
        )}
      </div>
    </div>
  );
}
