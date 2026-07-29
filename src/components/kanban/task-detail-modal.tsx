"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar, CalendarDays, User } from "lucide-react";
import { PRIORITY_COLORS } from "@/lib/constants";
import { AreaBadge } from "@/components/areas/area-badge";
import { CommentList } from "@/components/comments/comment-list";
import type { BoardTask } from "@/hooks/use-kanban";

export function TaskDetailModal({
  task,
  open,
  onOpenChange,
  onEdit,
}: {
  task: BoardTask;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: () => void;
}) {
  const priorityColor = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" role="dialog" aria-modal="true">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium"
              style={{ color: priorityColor.text, backgroundColor: priorityColor.bg }}
            >
              {task.priority}
            </span>
            <span className="text-caption text-text-secondary">#{task.id.slice(0, 8)}</span>
          </div>
          <DialogTitle>{task.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {task.description && (
            <p className="text-body-small text-text-secondary whitespace-pre-wrap">{task.description}</p>
          )}

          <div className="grid grid-cols-2 gap-3">
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
      </DialogContent>
    </Dialog>
  );
}
