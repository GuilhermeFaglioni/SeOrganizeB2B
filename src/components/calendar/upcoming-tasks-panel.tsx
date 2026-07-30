"use client";

import { CalendarDays, Plus } from "lucide-react";
import { PRIORITY_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";

import type { UpcomingTask } from "@/hooks/use-calendar";
import { useScheduleEventDialog } from "@/stores/schedule-event-context";
import { AvatarGroup } from "@/components/people/avatar-group";

const PRIORITY_BORDER: Record<string, string> = {
  urgent: "#dc2626",
  high: "#f97316",
  medium: "#d97706",
  low: "#9ca3af",
};

export function UpcomingTasksPanel({
  tasks,
  isLoading,
  error,
  onRetry,
}: {
  tasks: UpcomingTask[];
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
}) {
  const { openScheduleEvent } = useScheduleEventDialog();
  const sorted = [...tasks]
    .filter((t) => t.dueDate)
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());

  return (
    <div data-testid="upcoming-tasks" className="space-y-3">
      <h3 className="text-label font-semibold text-text-primary">Upcoming Tasks</h3>
      {isLoading && (
        <div className="space-y-2" aria-label="Carregando próximas tarefas">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-20 animate-pulse rounded-xl border border-border bg-white"
            />
          ))}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-danger/20 bg-danger-bg p-3 text-sm text-danger">
          <p>Falha ao carregar próximas tarefas.</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 font-semibold underline underline-offset-2"
          >
            Tentar novamente
          </button>
        </div>
      )}
      {!isLoading && !error && sorted.length === 0 && (
        <div className="text-body-small text-text-secondary text-center py-4">No upcoming tasks</div>
      )}
      {!isLoading && !error && <div className="space-y-2">
        {sorted.map((task) => {
          const borderColor = PRIORITY_BORDER[task.priority] || PRIORITY_BORDER.low;
          const priorityColor = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.low;

          return (
            <div
              key={task.id}
              className={cn(
                "flex items-start gap-3 bg-white rounded-lg p-3 border-l-[3px]",
                "group border border-border/70 shadow-card"
              )}
              style={{ borderLeftColor: borderColor }}
            >
              <CalendarDays size={16} className="text-text-secondary shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="truncate text-[14px] font-medium text-text-primary">
                  {task.title}
                </p>
                {task.dueDate && (
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[12px] text-text-secondary">
                      {new Date(task.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                    <span
                      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium"
                      style={{ color: priorityColor.text, backgroundColor: priorityColor.bg }}
                    >
                      {task.priority}
                    </span>
                  </div>
                )}
                <div className="mt-2 flex items-center justify-between gap-2">
                  <AvatarGroup
                    people={task.assignees.map(
                      (assignment) => assignment.profile,
                    )}
                    limit={3}
                    size="sm"
                  />
                  <button
                    type="button"
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
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-accent opacity-0 transition-opacity hover:bg-brand-50 group-hover:opacity-100 focus:opacity-100"
                  >
                    <Plus className="h-3 w-3" />
                    Agendar
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>}
    </div>
  );
}
