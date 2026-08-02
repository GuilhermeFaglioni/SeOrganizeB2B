"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { KanbanCard } from "./kanban-card";
import type { BoardColumn, BoardTask } from "@/hooks/use-kanban";
import {
  groupBoardTasks,
  type BoardGroupBy,
} from "@/lib/board/task-transforms";

export function KanbanColumn({
  column,
  selectedTaskId,
  onTaskClick,
  onAddClick,
  areaFilter,
  onRenameColumn,
  onDeleteColumn,
  taskFilter,
  compact,
  projectName,
  allowColumnManagement = true,
  groupBy = "workflow",
}: {
  column: BoardColumn;
  selectedTaskId?: string;
  onTaskClick?: (taskId: string) => void;
  onAddClick?: () => void;
  areaFilter?: string | null;
  onRenameColumn?: (columnId: string, name: string) => void;
  onDeleteColumn?: (columnId: string) => void;
  taskFilter?: (task: BoardTask) => boolean;
  compact?: boolean;
  projectName?: string;
  allowColumnManagement?: boolean;
  groupBy?: BoardGroupBy;
}) {
  const t = useTranslations("kanban.column");
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const [menuOpen, setMenuOpen] = useState(false);

  const areaIds = areaFilter?.split(",").filter(Boolean) || [];
  const filteredByArea = areaIds.length > 0
    ? column.tasks.filter((t) => t.area?.id && areaIds.includes(t.area.id))
    : column.tasks;
  const displayedTasks = taskFilter ? filteredByArea.filter(taskFilter) : filteredByArea;
  const taskGroups = groupBoardTasks(displayedTasks, groupBy);

  return (
    <div
      data-testid={`kanban-column-${column.name}`}
      className={cn(
        "h-full min-h-0 flex-shrink-0 flex flex-col gap-4 snap-start",
        compact ? "w-[260px] min-w-[240px]" : "w-[280px] min-w-[260px]"
      )}
      role="region"
      aria-label={t("columnAria", { name: column.name })}
    >
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <h3 className="text-label font-semibold text-text-primary">{column.name}</h3>
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-bg-tertiary text-caption text-text-secondary">
            {displayedTasks.length}
          </span>
        </div>
        {allowColumnManagement && (
        <div className="flex items-center gap-1">
          <button
            onClick={onAddClick}
            className="text-text-secondary hover:text-text-primary transition-colors p-1"
            aria-label={t("addTaskAria", { name: column.name })}
          >
            <Plus size={16} />
          </button>
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="text-text-secondary hover:text-text-primary transition-colors p-1"
              aria-label={t("optionsAria", { name: column.name })}
            >
              <MoreHorizontal size={16} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 w-36 bg-page-alt border border-border rounded-lg shadow-lg py-1">
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onRenameColumn?.(column.id, column.name);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-bg-secondary"
                  >
                    <Pencil size={14} />
                    {t("rename")}
                  </button>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onDeleteColumn?.(column.id);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-bg-secondary"
                  >
                    <Trash2 size={14} />
                    {t("delete")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        )}
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[60px] flex-1 flex-col gap-[10px] overflow-y-auto rounded-lg p-2 transition-colors",
          isOver ? "bg-accent/10" : "bg-bg-secondary/50"
        )}
      >
        {taskGroups.map((group) => (
          <div key={group.key} className="space-y-2">
            {groupBy !== "workflow" && (
              <div className="flex items-center justify-between px-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                <span className="truncate">{group.label}</span>
                <span>{group.tasks.length}</span>
              </div>
            )}
            <SortableContext
              items={group.tasks.map((task) => task.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-[10px]">
                {group.tasks.map((task) => (
                  <KanbanCard
                    key={task.id}
                    task={task}
                    isSelected={task.id === selectedTaskId}
                    onClick={() => onTaskClick?.(task.id)}
                    projectName={projectName}
                  />
                ))}
              </div>
            </SortableContext>
          </div>
        ))}
        {displayedTasks.length === 0 && (
          <div className="text-caption text-text-secondary text-center py-4">
            {areaFilter ? t("noTasksForArea") : t("noTasksYet")}
          </div>
        )}
      </div>
    </div>
  );
}
