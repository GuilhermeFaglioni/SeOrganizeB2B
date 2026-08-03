import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../../prisma/client";
import { denyFor } from "@/lib/authz/authz";
import { getUser } from "@/lib/supabase/server";

export async function GET(request: NextRequest, { params }: { params: { projectId: string } }) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const includeTasks = searchParams.get("includeTasks") === "true";

  const columns = await prisma.projectColumn.findMany({
    where: { projectId: params.projectId },
    orderBy: { position: "asc" },
    include: includeTasks
      ? {
          tasks: {
            where: { archived: false },
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
          },
        }
      : { _count: { select: { tasks: true } } },
  });

  return NextResponse.json({ data: columns, error: null });
}

export async function POST(request: NextRequest, { params }: { params: { projectId: string } }) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }

  const denied = await denyFor(user.id, "projects.edit");
  if (denied) return denied;

  const body = await request.json();
  const { name, color } = body;

  if (!name || typeof name !== "string") {
    return NextResponse.json({ data: null, error: { code: "VALIDATION_ERROR", message: "Name is required" } }, { status: 400 });
  }

  const lastColumn = await prisma.projectColumn.findFirst({
    where: { projectId: params.projectId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const position = lastColumn ? lastColumn.position + 1024 : 1024;

  const column = await prisma.projectColumn.create({
    data: {
      projectId: params.projectId,
      name,
      color: color || null,
      position,
    },
  });

  return NextResponse.json({ data: column, error: null }, { status: 201 });
}
