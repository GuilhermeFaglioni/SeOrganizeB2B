import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../prisma/client";
import { getSession } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("project_id");

  const where: Record<string, unknown> = { createdBy: session.user.id };
  if (projectId) where.projectId = projectId;

  const documents = await prisma.document.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      project: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ data: documents, error: null });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }

  const body = await request.json();
  const { title, content, projectId } = body;

  if (!title || typeof title !== "string") {
    return NextResponse.json({ data: null, error: { code: "VALIDATION_ERROR", message: "Title is required" } }, { status: 400 });
  }

  const document = await prisma.document.create({
    data: {
      title,
      content: content || "",
      projectId: projectId || null,
      createdBy: session.user.id,
    },
    include: {
      project: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ data: document, error: null }, { status: 201 });
}
