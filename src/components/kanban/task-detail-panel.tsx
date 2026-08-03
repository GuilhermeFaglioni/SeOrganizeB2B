"use client";

import { X, Calendar, CalendarDays, Users, Trash2, Archive } from "lucide-react";
import { useTranslations } from "next-intl";
import { PRIORITY_COLORS } from "@/lib/constants";
import { AreaBadge } from "@/components/areas/area-badge";
import { Button } from "@/components/ui/button";
import { CommentList } from "@/components/comments/comment-list";
import type { BoardTask } from "@/hooks/use-kanban";
import { AvatarGroup } from "@/components/people/avatar-group";
import { useScheduleEventDialog } from "@/stores/schedule-event-context";
import { ActivityFeed } from "@/components/activity/activity-feed";
import { useCan } from "@/hooks/use-permissions";

export function TaskDetailPanel({
  task,
  onClose,
  onEdit,
  onDelete,
  onArchive,
}: {
  task: BoardTask;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onArchive?: () => void;
}) {
  const t = useTranslations("kanban.taskDetailPanel");
  const { can } = useCan();
  const priorityColor = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium;
  const { openScheduleEvent } = useScheduleEventDialog();

  return (
    <div
      data-testid="task-detail-panel"
      className="fixed inset-x-0 top-14 bottom-0 z-40 flex h-auto w-full flex-col overflow-hidden border-0 bg-page-alt shadow-modal sm:static sm:z-auto sm:h-full sm:w-[400px] sm:shrink-0 sm:overflow-y-auto sm:border-l sm:shadow-none"
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
        <button onClick={onClose} className="flex min-h-[44px] min-w-[44px] items-center justify-center text-text-secondary hover:text-text-primary" aria-label={t("closeDetails")}>
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-4">
        <div>
          <h2 className="text-heading-1 font-semibold text-text-primary mb-2">{task.title}</h2>
          <span className="sr-only">{t("srOnlyLabel")}</span>
          {task.description && (
            <p className="text-body-small text-text-secondary whitespace-pre-wrap">{task.description}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          {task.assignees.length > 0 && (
            <div className="flex items-center gap-2">
              <Users size={14} className="text-text-secondary" />
              <AvatarGroup
                people={task.assignees.map((assignment) => assignment.profile)}
              />
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

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            className="min-w-0 flex-1 items-center gap-1 sm:flex-none"
            onClick={() =>
              openScheduleEvent({
                taskId: task.id,
                taskTitle: task.title,
                taskDueDate: task.dueDate,
                profileIds: task.assignees.map(
                  (assignment) => assignment.profileId,
                ),
              })
            }
          >
            <Calendar size={14} />
            {t("scheduleInCalendar")}
          </Button>
          {onEdit && can("tasks.edit") && (
            <Button size="sm" variant="outline" onClick={onEdit}>
              {t("edit")}
            </Button>
          )}
          {onDelete && can("tasks.delete") && (
            <Button size="sm" variant="outline" className="text-danger hover:text-danger" onClick={onDelete}>
              <Trash2 size={14} />
            </Button>
          )}
          {onArchive && can("tasks.edit") && (
            <Button size="sm" variant="outline" onClick={onArchive}>
              <Archive size={14} />
              {t("archive")}
            </Button>
          )}
        </div>

        <CommentList taskId={task.id} />
        <div className="border-t border-border pt-5">
          <h3 className="mb-3 text-sm font-semibold text-text-primary">
            {t("timeline")}
          </h3>
          <ActivityFeed taskId={task.id} />
        </div>
      </div>
    </div>
  );
}
