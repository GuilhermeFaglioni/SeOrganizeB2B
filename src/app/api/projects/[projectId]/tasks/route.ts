import { NextRequest, NextResponse } from "next/server";
import { prisma, withTenant } from "../../../../../../prisma/client";
import { getUser } from "@/lib/supabase/server";
import { denyFor } from "@/lib/authz/authz";
import { applyScopeFilter } from "@/lib/authz/scope-filter";
import { getTenantContext } from "@/lib/authz/tenant-context";
import { noWorkspaceResponse } from "@/lib/authz/http";
import { applyFeatureGate, withFeatureWarning } from "@/lib/middleware/feature-gating";
import { recordActivity } from "@/lib/activity/record";
import { sendPushToUsers, buildPushPayload } from "@/lib/push";

export async function GET(request: NextRequest, { params }: { params: { projectId: string } }) {
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
    pathname: "/api/projects/[projectId]/tasks",
    method: "GET",
    tenantContext: ctx,
  });
  if (gate.response) return gate.response;

  const { searchParams } = new URL(request.url);
  const columnId = searchParams.get("column_id");
  const areaId = searchParams.get("area_id");
  const assigneeId = searchParams.get("assignee_id");

  return withTenant(ctx.tenantId, async () => {
    const where = await applyScopeFilter(user.id, ctx.tenantId, "task", {
      projectId: params.projectId,
      ...(columnId ? { columnId } : {}),
      ...(areaId ? { areaId } : {}),
      ...(assigneeId
        ? { assignees: { some: { profileId: assigneeId } } }
        : {}),
    });
    const tasks = await prisma.task.findMany({
      where,
      orderBy: { position: "asc" },
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

    return NextResponse.json({ data: tasks, error: null });
  });
}

export async function POST(request: NextRequest, { params }: { params: { projectId: string } }) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }

  const denied = await denyFor(user.id, "tasks.create");
  if (denied) return denied;

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

  const gate = await applyFeatureGate({
    userId: user.id,
    pathname: "/api/projects/[projectId]/tasks",
    method: "POST",
    tenantContext: ctx,
  });
  if (gate.response) return gate.response;

  const body = await request.json();
  const {
    title,
    description,
    columnId,
    assigneeIds: rawAssigneeIds,
    areaId,
    priority,
    dueDate,
    recurrenceType,
    recurrenceInterval,
  } = body;
  const assigneeIds = Array.from(
    new Set(
      Array.isArray(rawAssigneeIds)
        ? rawAssigneeIds.filter(
            (id): id is string => typeof id === "string" && Boolean(id)
          )
        : []
    )
  );

  if (!title || typeof title !== "string") {
    return NextResponse.json({ data: null, error: { code: "VALIDATION_ERROR", message: "Title is required" } }, { status: 400 });
  }
  if (!columnId || typeof columnId !== "string") {
    return NextResponse.json({ data: null, error: { code: "VALIDATION_ERROR", message: "Column is required" } }, { status: 400 });
  }
  if (
    recurrenceType !== undefined &&
    recurrenceType !== null &&
    !["daily", "weekly", "monthly"].includes(recurrenceType)
  ) {
    return NextResponse.json(
      {
        data: null,
        error: { code: "VALIDATION_ERROR", message: "Invalid recurrence type" },
      },
      { status: 400 }
    );
  }
  const normalizedInterval = recurrenceType
    ? Number(recurrenceInterval ?? 1)
    : null;
  if (
    recurrenceType &&
    (!Number.isInteger(normalizedInterval) ||
      Number(normalizedInterval) < 1 ||
      Number(normalizedInterval) > 365)
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

  return withTenant(ctx.tenantId, async () => {
    if (assigneeIds.length > 0) {
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
    }

    const lastTask = await prisma.task.findFirst({
      where: { projectId: params.projectId, columnId },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const position = lastTask ? lastTask.position + 1024 : 1024;

    const task = await prisma.$transaction(async (tx) => {
      const created = await tx.task.create({
        data: {
          projectId: params.projectId,
          columnId,
          title,
          description: description || null,
          areaId: areaId || null,
          priority: priority || "medium",
          dueDate: dueDate ? new Date(dueDate) : null,
          position,
          createdBy: user.id,
          recurrenceType: recurrenceType || null,
          recurrenceInterval: normalizedInterval,
          recurrenceSeriesId: recurrenceType ? crypto.randomUUID() : null,
          tenantId: ctx.tenantId!,
          assignees: {
            create: assigneeIds.map((profileId) => ({
              profileId,
              assignedBy: user.id,
              tenantId: ctx.tenantId!,
            })),
          },
        },
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
      const activity = await recordActivity(tx, {
        actorId: user.id,
        taskId: created.id,
        type: "task.created",
        entityType: "task",
        entityId: created.id,
        summary: `Criou a tarefa "${created.title}"`,
        notifyProfileIds: assigneeIds,
      });
      return { created, activity };
    });

    // Send push notifications after transaction commits
    if (task.activity.notifiedProfileIds.length > 0) {
      const pushPayload = buildPushPayload({
        activityType: "task.created",
        summary: `Criou a tarefa "${task.created.title}"`,
        actorName: user.email || "Sistema",
        entityType: "task",
        entityId: task.created.id,
      });
      if (pushPayload) {
        await sendPushToUsers(task.activity.notifiedProfileIds, pushPayload);
      }
    }

    return withFeatureWarning(
      NextResponse.json({ data: task.created, error: null }, { status: 201 }),
      gate.warning
    );
  });
}
