import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../../prisma/client";
import { getSession } from "@/lib/supabase/server";
import { extractMentionProfileIds } from "@/lib/mentions";
import { recordActivity } from "@/lib/activity/record";

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
      mentions: {
        include: {
          profile: {
            select: { id: true, name: true, avatarUrl: true },
          },
        },
      },
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

  const normalizedContent = content.trim();
  const mentionProfileIds = extractMentionProfileIds(normalizedContent);
  const matchingProfiles = await prisma.profile.count({
    where: { id: { in: mentionProfileIds } },
  });
  if (matchingProfiles !== mentionProfileIds.length) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: "VALIDATION_ERROR",
          message: "One or more mentioned profiles do not exist",
        },
      },
      { status: 400 }
    );
  }

  const comment = await prisma.$transaction(async (tx) => {
    const created = await tx.comment.create({
      data: {
        taskId: params.taskId,
        authorId: session.user.id,
        content: normalizedContent,
        mentions: {
          create: mentionProfileIds.map((profileId) => ({ profileId })),
        },
      },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        mentions: {
          include: {
            profile: {
              select: { id: true, name: true, avatarUrl: true },
            },
          },
        },
      },
    });
    await recordActivity(tx, {
      actorId: session.user.id,
      taskId: params.taskId,
      type: mentionProfileIds.length ? "comment.mentioned" : "comment.created",
      entityType: "comment",
      entityId: created.id,
      summary: mentionProfileIds.length
        ? "Comentou e mencionou pessoas na tarefa"
        : "Adicionou comentário na tarefa",
      notifyProfileIds: mentionProfileIds,
    });
    return created;
  });

  return NextResponse.json({ data: comment, error: null }, { status: 201 });
}
