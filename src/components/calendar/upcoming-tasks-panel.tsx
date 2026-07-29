"use client";

import { CalendarDays, CheckCircle2 } from "lucide-react";
import { PRIORITY_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface UpcomingTask {
  id: string;
  title: string;
  priority: string;
  dueDate: string | null;
  completed?: boolean;
}

const PRIORITY_BORDER: Record<string, string> = {
  urgent: "#dc2626",
  high: "#f97316",
  medium: "#d97706",
  low: "#9ca3af",
};

export function UpcomingTasksPanel({ tasks }: { tasks: UpcomingTask[] }) {
  const sorted = [...tasks]
    .filter((t) => t.dueDate)
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());

  return (
    <div data-testid="upcoming-tasks" className="space-y-3">
      <h3 className="text-label font-semibold text-text-primary">Upcoming Tasks</h3>
      {sorted.length === 0 && (
        <div className="text-body-small text-text-secondary text-center py-4">No upcoming tasks</div>
      )}
      <div className="space-y-2">
        {sorted.map((task) => {
          const borderColor = PRIORITY_BORDER[task.priority] || PRIORITY_BORDER.low;
          const priorityColor = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.low;

          return (
            <div
              key={task.id}
              className={cn(
                "flex items-start gap-3 bg-white rounded-lg p-3 border-l-[3px]",
                task.completed && "opacity-60"
              )}
              style={{ borderLeftColor: borderColor }}
            >
              {task.completed ? (
                <CheckCircle2 size={16} className="text-green-500 shrink-0 mt-0.5" />
              ) : (
                <CalendarDays size={16} className="text-text-secondary shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <p className={cn("text-[14px] text-text-primary truncate", task.completed && "line-through")}>
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
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
