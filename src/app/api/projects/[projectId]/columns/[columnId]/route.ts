import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../../../prisma/client";
import { getSession } from "@/lib/supabase/server";

export async function PATCH(request: NextRequest, { params }: { params: { projectId: string; columnId: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }

  const column = await prisma.projectColumn.findUnique({ where: { id: params.columnId } });
  if (!column) {
    return NextResponse.json({ data: null, error: { code: "NOT_FOUND", message: "Column not found" } }, { status: 404 });
  }

  const body = await request.json();
  const { name, color } = body;

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (color !== undefined) data.color = color;

  const updated = await prisma.projectColumn.update({
    where: { id: params.columnId },
    data,
  });

  return NextResponse.json({ data: updated, error: null });
}

export async function DELETE(request: NextRequest, { params }: { params: { projectId: string; columnId: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }

  const column = await prisma.projectColumn.findUnique({
    where: { id: params.columnId },
    include: { _count: { select: { tasks: true } } },
  });

  if (!column) {
    return NextResponse.json({ data: null, error: { code: "NOT_FOUND", message: "Column not found" } }, { status: 404 });
  }

  if (column._count.tasks > 0) {
    return NextResponse.json({ data: null, error: { code: "CONFLICT", message: "Cannot delete column with existing tasks" } }, { status: 409 });
  }

  await prisma.projectColumn.delete({ where: { id: params.columnId } });

  return NextResponse.json({ data: { id: params.columnId }, error: null });
}
