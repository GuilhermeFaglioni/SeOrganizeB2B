import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../prisma/client";
import { getSession } from "@/lib/supabase/server";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }

  const task = await prisma.task.findUnique({
    where: { id: params.id },
    include: {
      assignee: { select: { id: true, name: true, avatarUrl: true } },
      area: { select: { id: true, name: true, color: true } },
      column: { select: { id: true, name: true } },
      _count: { select: { comments: true } },
    },
  });

  if (!task) {
    return NextResponse.json({ data: null, error: { code: "NOT_FOUND", message: "Task not found" } }, { status: 404 });
  }

  return NextResponse.json({ data: task, error: null });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }

  const task = await prisma.task.findUnique({ where: { id: params.id } });
  if (!task) {
    return NextResponse.json({ data: null, error: { code: "NOT_FOUND", message: "Task not found" } }, { status: 404 });
  }

  const body = await request.json();
  const { title, description, columnId, assigneeId, areaId, priority, dueDate } = body;

  const data: Record<string, unknown> = {};
  if (title !== undefined) data.title = title;
  if (description !== undefined) data.description = description;
  if (columnId !== undefined) data.columnId = columnId;
  if (assigneeId !== undefined) data.assigneeId = assigneeId;
  if (areaId !== undefined) data.areaId = areaId;
  if (priority !== undefined) data.priority = priority;
  if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;

  const updated = await prisma.task.update({
    where: { id: params.id },
    data,
    include: {
      assignee: { select: { id: true, name: true, avatarUrl: true } },
      area: { select: { id: true, name: true, color: true } },
      _count: { select: { comments: true } },
    },
  });

  return NextResponse.json({ data: updated, error: null });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }

  const task = await prisma.task.findUnique({ where: { id: params.id } });
  if (!task) {
    return NextResponse.json({ data: null, error: { code: "NOT_FOUND", message: "Task not found" } }, { status: 404 });
  }

  await prisma.task.delete({ where: { id: params.id } });

  return NextResponse.json({ data: { id: params.id }, error: null });
}
