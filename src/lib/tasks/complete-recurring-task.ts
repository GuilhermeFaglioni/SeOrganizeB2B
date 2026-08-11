import type { Prisma } from "@prisma/client";
import { nextRecurrenceDate, type RecurrenceType } from "@/lib/recurrence";
import { recordActivity } from "@/lib/activity/record";
import { requireTenantId } from "../../../prisma/client";

interface RecurringTask {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  areaId: string | null;
  priority: string;
  dueDate: Date | null;
  recurrenceType: string | null;
  recurrenceInterval: number | null;
  recurrenceSeriesId: string | null;
  recurrenceGeneratedAt: Date | null;
  assignees: Array<{ profileId: string }>;
}

export async function completeRecurringTask(
  tx: Prisma.TransactionClient,
  task: RecurringTask,
  actorId: string,
  completedAt = new Date()
) {
  if (
    !task.recurrenceType ||
    !["daily", "weekly", "monthly"].includes(task.recurrenceType)
  ) {
    return null;
  }
  const interval = task.recurrenceInterval ?? 1;
  const seriesId = task.recurrenceSeriesId ?? task.id;
  const claimed = await tx.task.updateMany({
    where: { id: task.id, recurrenceGeneratedAt: null },
    data: { recurrenceGeneratedAt: completedAt, recurrenceSeriesId: seriesId },
  });
  if (claimed.count !== 1) return null;

  const targetColumn = await tx.projectColumn.findFirst({
    where: { projectId: task.projectId, completesTasks: false },
    orderBy: { position: "asc" },
  });
  if (!targetColumn) {
    throw new Error("Recurring task requires an incomplete project column");
  }
  const lastTask = await tx.task.findFirst({
    where: { projectId: task.projectId, columnId: targetColumn.id },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const nextTask = await tx.task.create({
    data: {
      projectId: task.projectId,
      columnId: targetColumn.id,
      title: task.title,
      description: task.description,
      areaId: task.areaId,
      priority: task.priority,
      dueDate: nextRecurrenceDate(
        task.dueDate ?? completedAt,
        task.recurrenceType as RecurrenceType,
        interval
      ),
      position: (lastTask?.position ?? 0) + 1024,
      createdBy: actorId,
      recurrenceType: task.recurrenceType,
      recurrenceInterval: interval,
      recurrenceSeriesId: seriesId,
      tenantId: requireTenantId("tasks.complete-recurring"),
      assignees: {
        create: task.assignees.map(({ profileId }) => ({
          profileId,
          assignedBy: actorId,
          tenantId: requireTenantId("tasks.complete-recurring"),
        })),
      },
    },
  });
  await recordActivity(tx, {
    actorId,
    taskId: nextTask.id,
    type: "task.recurrence_created",
    entityType: "task",
    entityId: nextTask.id,
    summary: `Próxima ocorrência criada: ${nextTask.title}`,
    metadata: { sourceTaskId: task.id, seriesId },
    notifyProfileIds: task.assignees.map(({ profileId }) => profileId),
  });
  return nextTask;
}
