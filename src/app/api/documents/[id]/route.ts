import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../prisma/client";
import { getUser } from "@/lib/supabase/server";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }

  const doc = await prisma.document.findUnique({
    where: { id: params.id },
    include: {
      project: { select: { id: true, name: true } },
    },
  });

  if (!doc) {
    return NextResponse.json({ data: null, error: { code: "NOT_FOUND", message: "Document not found" } }, { status: 404 });
  }

  return NextResponse.json({ data: doc, error: null });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }

  const doc = await prisma.document.findUnique({ where: { id: params.id } });
  if (!doc) {
    return NextResponse.json({ data: null, error: { code: "NOT_FOUND", message: "Document not found" } }, { status: 404 });
  }

  const body = await request.json();
  const { title, content, projectId } = body;

  const data: Record<string, unknown> = {};
  if (title !== undefined) data.title = title;
  if (content !== undefined) data.content = content;
  if (projectId !== undefined) data.projectId = projectId;

  const updated = await prisma.document.update({
    where: { id: params.id },
    data,
    include: {
      project: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ data: updated, error: null });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }

  const doc = await prisma.document.findUnique({ where: { id: params.id } });
  if (!doc) {
    return NextResponse.json({ data: null, error: { code: "NOT_FOUND", message: "Document not found" } }, { status: 404 });
  }

  await prisma.document.delete({ where: { id: params.id } });

  return NextResponse.json({ data: { id: params.id }, error: null });
}
