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
import { useTranslations } from "next-intl";
import { KanbanColumn } from "./kanban-column";
import { KanbanCard } from "./kanban-card";
import { useMoveTask, useColumns, type BoardColumn, type BoardTask } from "@/hooks/use-kanban";
import { useCan } from "@/hooks/use-permissions";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import type { BoardGroupBy } from "@/lib/board/task-transforms";

export function KanbanBoard({
  columns,
  projectId,
  selectedTaskId,
  onTaskClick,
  onAddClick,
  areaFilter,
  taskFilter,
  mode = "full",
  projectName,
  allowColumnManagement = true,
  groupBy = "workflow",
}: {
  columns: BoardColumn[];
  projectId: string;
  selectedTaskId?: string;
  onTaskClick?: (taskId: string) => void;
  onAddClick?: (columnId: string) => void;
  areaFilter?: string | null;
  taskFilter?: (task: BoardTask) => boolean;
  mode?: "full" | "compact";
  projectName?: string;
  allowColumnManagement?: boolean;
  groupBy?: BoardGroupBy;
}) {
  const t = useTranslations("kanban.board");
  const { can } = useCan();
  const [activeTask, setActiveTask] = useState<BoardTask | null>(null);
  const moveTask = useMoveTask(projectId);
  const { addColumn, renameColumn, deleteColumn } = useColumns(projectId);

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameColumnId, setRenameColumnId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");

  const [addColumnOpen, setAddColumnOpen] = useState(false);
  const [addColumnName, setAddColumnName] = useState("");

  const handleRenameClick = (columnId: string, currentName: string) => {
    setRenameColumnId(columnId);
    setRenameName(currentName);
    setRenameOpen(true);
  };

  const handleRenameSubmit = () => {
    if (renameColumnId && renameName.trim()) {
      renameColumn.mutate({ columnId: renameColumnId, name: renameName.trim() });
    }
    setRenameOpen(false);
    setRenameColumnId(null);
  };

  const handleDeleteColumn = (columnId: string) => {
    if (!can("projects.edit")) return;
    if (confirm(t("deleteColumnConfirm"))) {
      deleteColumn.mutate(columnId);
    }
  };

  const handleAddColumn = () => {
    if (addColumnName.trim()) {
      addColumn.mutate({ name: addColumnName.trim() });
    }
    setAddColumnOpen(false);
    setAddColumnName("");
  };

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

    let beforePosition: number | null = null;
    let afterPosition: number | null = null;

    if (overIsColumn) {
      if (filteredTasks.length > 0) {
        beforePosition = filteredTasks[filteredTasks.length - 1].position;
      }
      afterPosition = null;
    } else {
      const overIndex = filteredTasks.findIndex((t) => t.id === over.id);
      if (overIndex >= 0) {
        beforePosition = overIndex > 0 ? filteredTasks[overIndex - 1].position : null;
        afterPosition = overIndex < filteredTasks.length ? filteredTasks[overIndex].position : null;
      }
    }

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
      <>
        <div
          data-testid="kanban-board"
          className="flex gap-4 overflow-x-auto pb-4 h-full snap-x snap-mandatory"
          role="list"
          aria-label={t("boardAria")}
        >
          {columns.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              selectedTaskId={selectedTaskId}
              onTaskClick={onTaskClick}
              onAddClick={() => onAddClick?.(column.id)}
              areaFilter={areaFilter}
              onRenameColumn={handleRenameClick}
              onDeleteColumn={handleDeleteColumn}
              taskFilter={taskFilter}
              compact={mode === "compact"}
              projectName={projectName}
              allowColumnManagement={allowColumnManagement}
              groupBy={groupBy}
            />
          ))}
          {can("projects.edit") && allowColumnManagement && (
          <div className="flex-shrink-0 w-[280px] min-w-[260px] flex items-start pt-2">
            <button
              onClick={() => setAddColumnOpen(true)}
              className="w-full flex items-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed border-border text-text-secondary hover:text-text-primary hover:border-accent transition-colors text-sm"
            >
              <Plus size={16} />
              {t("addColumn")}
            </button>
          </div>
          )}
        </div>
        <DragOverlay>
          {activeTask ? (
            <KanbanCard task={activeTask} projectName={projectName} />
          ) : null}
        </DragOverlay>

        <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("renameColumn")}</DialogTitle>
            </DialogHeader>
            <div className="py-2">
              <Input
                value={renameName}
                onChange={(e) => setRenameName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRenameSubmit()}
                placeholder={t("columnNamePlaceholder")}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRenameOpen(false)}>{t("cancel")}</Button>
              <Button onClick={handleRenameSubmit} disabled={!renameName.trim() || !can("projects.edit")}>{t("rename")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={addColumnOpen} onOpenChange={setAddColumnOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("addColumn")}</DialogTitle>
            </DialogHeader>
            <div className="py-2">
              <Input
                value={addColumnName}
                onChange={(e) => setAddColumnName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddColumn()}
                placeholder={t("columnNamePlaceholder")}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddColumnOpen(false)}>{t("cancel")}</Button>
              <Button onClick={handleAddColumn} disabled={!addColumnName.trim()}>{t("add")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    </DndContext>
  );
}
