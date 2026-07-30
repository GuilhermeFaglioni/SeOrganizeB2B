"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarDays, MessageSquare, GripVertical, FolderKanban, Repeat2 } from "lucide-react";
import { PRIORITY_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { AreaBadge } from "@/components/areas/area-badge";
import type { BoardTask } from "@/hooks/use-kanban";
import { AvatarGroup } from "@/components/people/avatar-group";

export function KanbanCard({
  task,
  isSelected,
  onClick,
  projectName,
}: {
  task: BoardTask;
  isSelected?: boolean;
  onClick?: () => void;
  projectName?: string;
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
      {...attributes}
      {...listeners}
      data-testid={`task-card-${task.id}`}
      role="button"
      tabIndex={0}
      aria-label={`Task: ${task.title}`}
      className={cn(
        "touch-none cursor-grab rounded-lg border bg-white p-[10px] shadow-card transition-[transform,box-shadow,border-color] hover:shadow-elevated motion-safe:hover:-translate-y-0.5 active:cursor-grabbing",
        isOverdue && "border-danger",
        isSelected && "border-[2px] border-accent",
        isDragging && "opacity-50"
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1">
          <GripVertical size={14} className="text-text-secondary" />
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
        <div className="flex items-center gap-2 min-w-0">
          {projectName && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-text-secondary truncate">
              <FolderKanban size={10} className="shrink-0" />
              <span className="truncate">{projectName}</span>
            </span>
          )}
          {task.area && (
            <AreaBadge name={task.area.name} color={task.area.color} compact />
          )}
        </div>
        <div className="flex items-center gap-2">
          {task.recurrenceType && (
            <span
              className="inline-flex items-center text-text-secondary"
              title={`Repeats ${task.recurrenceType}`}
            >
              <Repeat2 size={11} />
            </span>
          )}
          <AvatarGroup
            people={task.assignees.map((assignment) => assignment.profile)}
            size="xs"
          />
          {task._count.comments > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-text-secondary shrink-0">
              <MessageSquare size={10} />
              {task._count.comments}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
