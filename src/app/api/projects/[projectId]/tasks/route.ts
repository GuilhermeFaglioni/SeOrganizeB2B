import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../../prisma/client";
import { getSession } from "@/lib/supabase/server";

export async function GET(request: NextRequest, { params }: { params: { projectId: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const columnId = searchParams.get("column_id");
  const areaId = searchParams.get("area_id");
  const assigneeId = searchParams.get("assignee_id");

  const where: Record<string, unknown> = { projectId: params.projectId };
  if (columnId) where.columnId = columnId;
  if (areaId) where.areaId = areaId;
  if (assigneeId) where.assigneeId = assigneeId;

  const tasks = await prisma.task.findMany({
    where,
    orderBy: { position: "asc" },
    include: {
      assignee: { select: { id: true, name: true, avatarUrl: true } },
      area: { select: { id: true, name: true, color: true } },
      _count: { select: { comments: true } },
    },
  });

  return NextResponse.json({ data: tasks, error: null });
}

export async function POST(request: NextRequest, { params }: { params: { projectId: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }

  const body = await request.json();
  const { title, description, columnId, assigneeId, areaId, priority, dueDate } = body;

  if (!title || typeof title !== "string") {
    return NextResponse.json({ data: null, error: { code: "VALIDATION_ERROR", message: "Title is required" } }, { status: 400 });
  }
  if (!columnId || typeof columnId !== "string") {
    return NextResponse.json({ data: null, error: { code: "VALIDATION_ERROR", message: "Column is required" } }, { status: 400 });
  }

  const lastTask = await prisma.task.findFirst({
    where: { projectId: params.projectId, columnId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const position = lastTask ? lastTask.position + 1024 : 1024;

  const task = await prisma.task.create({
    data: {
      projectId: params.projectId,
      columnId,
      title,
      description: description || null,
      assigneeId: assigneeId || null,
      areaId: areaId || null,
      priority: priority || "medium",
      dueDate: dueDate ? new Date(dueDate) : null,
      position,
      createdBy: session.user.id,
    },
    include: {
      assignee: { select: { id: true, name: true, avatarUrl: true } },
      area: { select: { id: true, name: true, color: true } },
      _count: { select: { comments: true } },
    },
  });

  return NextResponse.json({ data: task, error: null }, { status: 201 });
}
