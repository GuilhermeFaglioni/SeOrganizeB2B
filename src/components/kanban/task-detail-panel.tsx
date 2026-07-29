"use client";

import { X, Calendar, CalendarDays, User } from "lucide-react";
import { PRIORITY_COLORS } from "@/lib/constants";
import { AreaBadge } from "@/components/areas/area-badge";
import { Button } from "@/components/ui/button";
import { CommentList } from "@/components/comments/comment-list";
import type { BoardTask } from "@/hooks/use-kanban";

export function TaskDetailPanel({
  task,
  onClose,
  onEdit,
}: {
  task: BoardTask;
  onClose: () => void;
  onEdit?: () => void;
}) {
  const priorityColor = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium;

  return (
    <div
      data-testid="task-detail-panel"
      className="w-[400px] bg-white border-l border-border overflow-y-auto flex flex-col h-full"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium"
            style={{ color: priorityColor.text, backgroundColor: priorityColor.bg }}
          >
            {task.priority}
          </span>
          <span className="text-caption text-text-secondary">#{task.id.slice(0, 8)}</span>
        </div>
        <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 px-4 py-4 space-y-6 overflow-y-auto">
        <div>
          <h2 className="text-heading-1 font-semibold text-text-primary mb-2">{task.title}</h2>
          {task.description && (
            <p className="text-body-small text-text-secondary whitespace-pre-wrap">{task.description}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          {task.assignee && (
            <div className="flex items-center gap-2">
              <User size={14} className="text-text-secondary" />
              <span className="text-body-small text-text-primary">{task.assignee.name || "Unassigned"}</span>
            </div>
          )}
          {task.area && <AreaBadge name={task.area.name} color={task.area.color} />}
          {task.dueDate && (
            <div className="flex items-center gap-2">
              <CalendarDays size={14} className="text-text-secondary" />
              <span className="text-body-small text-text-primary">
                {new Date(task.dueDate).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button size="sm" className="flex items-center gap-1">
            <Calendar size={14} />
            Schedule in Calendar
          </Button>
          {onEdit && (
            <Button size="sm" variant="outline" onClick={onEdit}>
              Edit
            </Button>
          )}
        </div>

        <CommentList taskId={task.id} />
      </div>
    </div>
  );
}
