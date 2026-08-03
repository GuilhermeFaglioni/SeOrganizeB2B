import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../prisma/client";
import { createDefaultColumns } from "../../../../src/lib/defaults";
import { denyFor } from "@/lib/authz/authz";
import { getUser } from "@/lib/supabase/server";

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }

  const denied = await denyFor(user.id, "projects.view");
  if (denied) return denied;

  const projects = await prisma.project.findMany({
    where: { archived: false },
    orderBy: { createdAt: "desc" },
    include: {
      area: true,
      _count: { select: { tasks: true } },
    },
  });

  return NextResponse.json({ data: projects, error: null });
}

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }

  const denied = await denyFor(user.id, "projects.create");
  if (denied) return denied;

  const body = await request.json();
  const { name, description, areaId } = body;

  if (!name || typeof name !== "string") {
    return NextResponse.json({ data: null, error: { code: "VALIDATION_ERROR", message: "Name is required" } }, { status: 400 });
  }

  const existing = await prisma.project.findFirst({ where: { name, archived: false } });
  if (existing) {
    return NextResponse.json({ data: null, error: { code: "CONFLICT", message: "Project name already exists" } }, { status: 409 });
  }

  const project = await prisma.project.create({
    data: {
      name,
      description: description || null,
      areaId: areaId || null,
      createdBy: user.id,
    },
  });

  await createDefaultColumns(project.id);

  return NextResponse.json({ data: project, error: null }, { status: 201 });
}
