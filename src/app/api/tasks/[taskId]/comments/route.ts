import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../../prisma/client";
import { getSession } from "@/lib/supabase/server";

export async function GET(request: NextRequest, { params }: { params: { taskId: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }

  const comments = await prisma.comment.findMany({
    where: { taskId: params.taskId },
    orderBy: { createdAt: "asc" },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  return NextResponse.json({ data: comments, error: null });
}

export async function POST(request: NextRequest, { params }: { params: { taskId: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }

  const body = await request.json();
  const { content } = body;

  if (!content || typeof content !== "string" || !content.trim()) {
    return NextResponse.json({ data: null, error: { code: "VALIDATION_ERROR", message: "Content is required" } }, { status: 400 });
  }

  const comment = await prisma.comment.create({
    data: {
      taskId: params.taskId,
      authorId: session.user.id,
      content: content.trim(),
    },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  return NextResponse.json({ data: comment, error: null }, { status: 201 });
}
