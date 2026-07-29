import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../prisma/client";
import { getSession } from "@/lib/supabase/server";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }

  const body = await request.json();
  const { name, description, areaId } = body;

  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) {
    return NextResponse.json({ data: null, error: { code: "NOT_FOUND", message: "Project not found" } }, { status: 404 });
  }

  if (name && name !== project.name) {
    const existing = await prisma.project.findFirst({ where: { name, archived: false, id: { not: params.id } } });
    if (existing) {
      return NextResponse.json({ data: null, error: { code: "CONFLICT", message: "Project name already exists" } }, { status: 409 });
    }
  }

  const updated = await prisma.project.update({
    where: { id: params.id },
    data: { ...(name !== undefined && { name }), ...(description !== undefined && { description }), ...(areaId !== undefined && { areaId }) },
  });

  return NextResponse.json({ data: updated, error: null });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }

  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) {
    return NextResponse.json({ data: null, error: { code: "NOT_FOUND", message: "Project not found" } }, { status: 404 });
  }

  await prisma.project.update({
    where: { id: params.id },
    data: { archived: true },
  });

  return NextResponse.json({ data: { id: params.id }, error: null });
}
