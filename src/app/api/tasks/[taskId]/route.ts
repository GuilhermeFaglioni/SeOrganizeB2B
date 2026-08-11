import { NextRequest, NextResponse } from "next/server";
import { prisma, withTenant } from "../../../../../prisma/client";
import { getUser } from "@/lib/supabase/server";
import { recordActivity } from "@/lib/activity/record";
import { denyFor } from "@/lib/authz/authz";
import { getTenantContext } from "@/lib/authz/tenant-context";
import { noWorkspaceResponse } from "@/lib/authz/http";
import { applyFeatureGate, withFeatureWarning } from "@/lib/middleware/feature-gating";
import { completeRecurringTask } from "@/lib/tasks/complete-recurring-task";
import { sendPushToUsers, buildPushPayload } from "@/lib/push";

export async function GET(request: NextRequest, { params }: { params: { taskId: string } }) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }

  const denied = await denyFor(user.id, "tasks.view");
  if (denied) return denied;

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

  const gate = await applyFeatureGate({
    userId: user.id,
    pathname: "/api/tasks/[taskId]",
    method: "GET",
    tenantContext: ctx,
  });
  if (gate.response) return gate.response;

  const task = await withTenant(ctx.tenantId, () =>
    prisma.task.findUnique({
      where: { id: params.taskId },
      include: {
        assignees: {
          include: {
            profile: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
        area: { select: { id: true, name: true, color: true } },
        column: { select: { id: true, name: true } },
        _count: { select: { comments: true } },
      },
    })
  );

  if (!task) {
    return NextResponse.json({ data: null, error: { code: "NOT_FOUND", message: "Task not found" } }, { status: 404 });
  }

  return NextResponse.json({ data: task, error: null });
}

export async function PATCH(request: NextRequest, { params }: { params: { taskId: string } }) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
    }

    const denied = await denyFor(user.id, "tasks.edit");
    if (denied) return denied;

    const ctx = await getTenantContext(user.id);
    if (!ctx.tenantId) return noWorkspaceResponse();

    const gate = await applyFeatureGate({
      userId: user.id,
      pathname: "/api/tasks/[taskId]",
      method: "PATCH",
      tenantContext: ctx,
    });
    if (gate.response) return gate.response;

    return withTenant(ctx.tenantId, async () => {
      const task = await prisma.task.findUnique({
        where: { id: params.taskId },
        include: {
          column: { select: { id: true, completesTasks: true } },
          assignees: { select: { profileId: true } },
        },
      });
      if (!task) {
        return NextResponse.json({ data: null, error: { code: "NOT_FOUND", message: "Task not found" } }, { status: 404 });
      }

      const body = await request.json();
      const {
        title,
        description,
        columnId,
        assigneeIds: rawAssigneeIds,
        areaId,
        priority,
        dueDate,
        position,
        archived,
        recurrenceType,
        recurrenceInterval,
      } = body;

      const data: Record<string, unknown> = {};
      if (title !== undefined) data.title = title;
      if (description !== undefined) data.description = description;
      if (columnId !== undefined) data.columnId = columnId;
      if (rawAssigneeIds !== undefined) {
        const assigneeIds = Array.from(
          new Set(
            Array.isArray(rawAssigneeIds)
              ? rawAssigneeIds.filter(
                  (id): id is string => typeof id === "string" && Boolean(id)
                )
              : []
          )
        );
        const matchingProfiles = await prisma.profile.count({
          where: { id: { in: assigneeIds }, tenantId: ctx.tenantId! },
        });
        if (matchingProfiles !== assigneeIds.length) {
          return NextResponse.json(
            {
              data: null,
              error: {
                code: "VALIDATION_ERROR",
                message: "One or more assignees do not exist",
              },
            },
            { status: 400 }
          );
        }
        data.assignees = {
          deleteMany: {},
          create: assigneeIds.map((profileId) => ({
            profileId,
            assignedBy: user.id,
            tenantId: ctx.tenantId!,
          })),
        };
      }
      if (areaId !== undefined) data.areaId = areaId;
      if (priority !== undefined) data.priority = priority;
      if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;
      if (position !== undefined) data.position = position;
      if (archived !== undefined) data.archived = archived;
      if (archived === true) data.archivedAt = new Date();
      if (recurrenceType !== undefined) {
        if (
          recurrenceType !== null &&
          !["daily", "weekly", "monthly"].includes(recurrenceType)
        ) {
          return NextResponse.json(
            {
              data: null,
              error: {
                code: "VALIDATION_ERROR",
                message: "Invalid recurrence type",
              },
            },
            { status: 400 }
          );
        }
        data.recurrenceType = recurrenceType;
        data.recurrenceInterval = recurrenceType
          ? Number(recurrenceInterval ?? 1)
          : null;
        if (
          recurrenceType &&
          (!Number.isInteger(data.recurrenceInterval) ||
            Number(data.recurrenceInterval) < 1 ||
            Number(data.recurrenceInterval) > 365)
        ) {
          return NextResponse.json(
            {
              data: null,
              error: {
                code: "VALIDATION_ERROR",
                message: "Recurrence interval must be from 1 to 365",
              },
            },
            { status: 400 }
          );
        }
      }

      const targetColumn = columnId
        ? await prisma.projectColumn.findFirst({
            where: { id: columnId, projectId: task.projectId },
            select: { id: true, completesTasks: true },
          })
        : task.column;
      if (columnId && !targetColumn) {
        return NextResponse.json(
          {
            data: null,
            error: {
              code: "VALIDATION_ERROR",
              message: "Column does not belong to task project",
            },
          },
          { status: 400 }
        );
      }

      let activityResult: { activityId: string; notifiedProfileIds: string[] } | null = null;
      let activityType = "";
      const transactionResult = await prisma.$transaction(async (tx) => {
        const result = await tx.task.update({
          where: { id: params.taskId },
          data,
          include: {
            assignees: {
              include: {
                profile: {
                  select: { id: true, name: true, email: true, avatarUrl: true },
                },
              },
            },
            area: { select: { id: true, name: true, color: true } },
            _count: { select: { comments: true } },
          },
        });
        const previousAssignees = new Set(
          task.assignees.map(({ profileId }) => profileId)
        );
        const addedAssignees = result.assignees
          .map(({ profileId }) => profileId)
          .filter((profileId) => !previousAssignees.has(profileId));
        const moved = Boolean(columnId && columnId !== task.columnId);
        activityType = moved
          ? "task.moved"
          : archived === true
            ? "task.archived"
            : rawAssigneeIds !== undefined
              ? "task.assigned"
              : "task.updated";
        activityResult = await recordActivity(tx, {
          actorId: user.id,
          taskId: result.id,
          type: activityType,
          entityType: "task",
          entityId: result.id,
          summary:
            activityType === "task.moved"
              ? `Moveu a tarefa "${result.title}"`
              : activityType === "task.archived"
                ? `Arquivou a tarefa "${result.title}"`
                : activityType === "task.assigned"
                  ? `Atualizou responsáveis de "${result.title}"`
                  : `Atualizou a tarefa "${result.title}"`,
          metadata: moved
            ? { fromColumnId: task.columnId, toColumnId: result.columnId }
            : { fields: Object.keys(data) },
          notifyProfileIds: addedAssignees,
        });
        if (
          moved &&
          task.column.completesTasks === false &&
          targetColumn?.completesTasks === true
        ) {
          await completeRecurringTask(tx, result, user.id);
        }
        return { result, activityResult, activityType };
      });

      const { result: updated, activityResult: transactionActivityResult, activityType: finalActivityType } = transactionResult;

      // Send push notifications after transaction commits
      if (transactionActivityResult && transactionActivityResult.notifiedProfileIds.length > 0) {
        const pushPayload = buildPushPayload({
          activityType: finalActivityType,
          summary: transactionActivityResult.notifiedProfileIds.length > 0 ? `Atualizou responsáveis de "${updated.title}"` : `Atualizou a tarefa "${updated.title}"`,
          actorName: user.email || "Sistema",
          entityType: "task",
          entityId: updated.id,
        });
        if (pushPayload) {
          await sendPushToUsers(transactionActivityResult.notifiedProfileIds, pushPayload);
        }
      }

      return withFeatureWarning(
        NextResponse.json({ data: updated, error: null }),
        gate.warning
      );
    });
  } catch (error) {
    console.error("PATCH task error:", error);
    return NextResponse.json({ data: null, error: { code: "INTERNAL_ERROR", message: error instanceof Error ? error.message : "Failed to update task" } }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { taskId: string } }) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }

  const denied = await denyFor(user.id, "tasks.delete");
  if (denied) return denied;

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

  const gate = await applyFeatureGate({
    userId: user.id,
    pathname: "/api/tasks/[taskId]",
    method: "DELETE",
    tenantContext: ctx,
  });
  if (gate.response) return gate.response;

  return withTenant(ctx.tenantId, async () => {
    const task = await prisma.task.findUnique({ where: { id: params.taskId } });
    if (!task) {
      return NextResponse.json({ data: null, error: { code: "NOT_FOUND", message: "Task not found" } }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await recordActivity(tx, {
        actorId: user.id,
        taskId: task.id,
        type: "task.deleted",
        entityType: "task",
        entityId: task.id,
        summary: `Excluiu a tarefa “${task.title}”`,
      });
      await tx.task.delete({ where: { id: params.taskId } });
    });

    return withFeatureWarning(
      NextResponse.json({ data: { id: params.taskId }, error: null }),
      gate.warning
    );
  });
}
