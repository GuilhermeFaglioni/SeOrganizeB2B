import { NextRequest, NextResponse } from "next/server";
import { prisma, withTenant } from "../../../../../../../prisma/client";
import { getUser } from "@/lib/supabase/server";
import { denyFor } from "@/lib/authz/authz";
import { getTenantContext } from "@/lib/authz/tenant-context";
import { noWorkspaceResponse } from "@/lib/authz/http";
import { recordActivity } from "@/lib/activity/record";

export async function DELETE(request: NextRequest, { params }: { params: { taskId: string; commentId: string } }) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }

  const denied = await denyFor(user.id, "tasks.edit");
  if (denied) return denied;

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

  return withTenant(ctx.tenantId, async () => {
    const comment = await prisma.comment.findFirst({
      where: { id: params.commentId, tenantId: ctx.tenantId! },
    });
    if (!comment) {
      return NextResponse.json({ data: null, error: { code: "NOT_FOUND", message: "Comment not found" } }, { status: 404 });
    }

    if (comment.authorId !== user.id) {
      return NextResponse.json({ data: null, error: { code: "FORBIDDEN", message: "Can only delete own comments" } }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.comment.delete({ where: { id: params.commentId } });
      await recordActivity(tx, {
        actorId: user.id,
        taskId: params.taskId,
        type: "comment.deleted",
        entityType: "comment",
        entityId: params.commentId,
        summary: "Removeu um comentário da tarefa",
      });
    });

    return NextResponse.json({ data: { id: params.commentId }, error: null });
  });
}
