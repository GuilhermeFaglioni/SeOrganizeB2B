import { NextRequest, NextResponse } from "next/server";
import { prisma, withTenant } from "../../../../../prisma/client";
import { denyFor } from "@/lib/authz/authz";
import { getTenantContext } from "@/lib/authz/tenant-context";
import { noWorkspaceResponse } from "@/lib/authz/http";
import { getUser } from "@/lib/supabase/server";

export async function GET(request: NextRequest, { params }: { params: { projectId: string } }) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }

  const denied = await denyFor(user.id, "projects.view");
  if (denied) return denied;

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

  const project = await withTenant(ctx.tenantId, () =>
    prisma.project.findUnique({
      where: { id: params.projectId },
      include: {
        area: true,
        _count: { select: { tasks: true, documents: true } },
        columns: {
          include: {
            _count: { select: { tasks: true } },
          },
          orderBy: { position: "asc" },
        },
        creator: { select: { id: true, name: true, email: true } },
      },
    })
  );

  if (!project) {
    return NextResponse.json({ data: null, error: { code: "NOT_FOUND", message: "Project not found" } }, { status: 404 });
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [overdueCount, archivedCount, thisWeekCount] = await withTenant(
    ctx.tenantId,
    () =>
      Promise.all([
        prisma.task.count({
          where: { projectId: params.projectId, archived: false, dueDate: { lt: todayStart } },
        }),
        prisma.task.count({
          where: { projectId: params.projectId, archived: true },
        }),
        prisma.task.count({
          where: {
            projectId: params.projectId,
            archived: false,
            dueDate: {
              gte: todayStart,
              lt: new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000),
            },
          },
        }),
      ])
  );

  const data = {
    ...project,
    stats: {
      totalTasks: project._count.tasks,
      overdueTasks: overdueCount,
      archivedTasks: archivedCount,
      thisWeekTasks: thisWeekCount,
      activeTasks: project._count.tasks - archivedCount,
      completionRate: project._count.tasks > 0 ? Math.round((archivedCount / project._count.tasks) * 100) : 0,
    },
  };

  return NextResponse.json({ data, error: null });
}

export async function PATCH(request: NextRequest, { params }: { params: { projectId: string } }) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }

  const denied = await denyFor(user.id, "projects.edit");
  if (denied) return denied;

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

  const body = await request.json();
  const { name, description, areaId } = body;

  return withTenant(ctx.tenantId, async () => {
    const project = await prisma.project.findFirst({
      where: { id: params.projectId, tenantId: ctx.tenantId! },
    });
    if (!project) {
      return NextResponse.json({ data: null, error: { code: "NOT_FOUND", message: "Project not found" } }, { status: 404 });
    }

    if (name && name !== project.name) {
      const existing = await prisma.project.findFirst({ where: { name, archived: false, id: { not: params.projectId }, tenantId: ctx.tenantId! } });
      if (existing) {
        return NextResponse.json({ data: null, error: { code: "CONFLICT", message: "Project name already exists" } }, { status: 409 });
      }
    }

    const updated = await prisma.project.update({
      where: { id: params.projectId },
      data: { ...(name !== undefined && { name }), ...(description !== undefined && { description }), ...(areaId !== undefined && { areaId }) },
    });

    return NextResponse.json({ data: updated, error: null });
  });
}

export async function DELETE(request: NextRequest, { params }: { params: { projectId: string } }) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }

  const denied = await denyFor(user.id, "projects.delete");
  if (denied) return denied;

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

  return withTenant(ctx.tenantId, async () => {
    const project = await prisma.project.findFirst({
      where: { id: params.projectId, tenantId: ctx.tenantId! },
    });
    if (!project) {
      return NextResponse.json({ data: null, error: { code: "NOT_FOUND", message: "Project not found" } }, { status: 404 });
    }

    await prisma.project.update({
      where: { id: params.projectId },
      data: { archived: true },
    });

    return NextResponse.json({ data: { id: params.projectId }, error: null });
  });
}
