import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../../prisma/client";
import { getUser } from "@/lib/supabase/server";
import { extractMentionProfileIds } from "@/lib/mentions";
import { recordActivity } from "@/lib/activity/record";
import { sendPushToUsers, buildPushPayload } from "@/lib/push";

export async function GET(request: NextRequest, { params }: { params: { taskId: string } }) {
  const user = await getUser();
  if (!user) {
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
  const user = await getUser();
  if (!user) {
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
        authorId: user.id,
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
    const activity = await recordActivity(tx, {
      actorId: user.id,
      taskId: params.taskId,
      type: mentionProfileIds.length ? "comment.mentioned" : "comment.created",
      entityType: "comment",
      entityId: created.id,
      summary: mentionProfileIds.length
        ? "Comentou e mencionou pessoas na tarefa"
        : "Adicionou comentário na tarefa",
      notifyProfileIds: mentionProfileIds,
    });
    return { created, activity };
  });

  // Send push notifications for mentions after transaction commits
  if (comment.activity.notifiedProfileIds.length > 0) {
    const pushPayload = buildPushPayload({
      activityType: "comment.mentioned",
      summary: "Comentou e mencionou pessoas na tarefa",
      actorName: user.email || "Sistema",
      entityType: "comment",
      entityId: comment.created.id,
    });
    if (pushPayload) {
      await sendPushToUsers(comment.activity.notifiedProfileIds, pushPayload);
    }
  }

  return NextResponse.json({ data: comment.created, error: null }, { status: 201 });
}
