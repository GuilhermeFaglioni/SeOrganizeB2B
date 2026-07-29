import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../../../prisma/client";
import { getSession } from "@/lib/supabase/server";

export async function DELETE(request: NextRequest, { params }: { params: { taskId: string; commentId: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }

  const comment = await prisma.comment.findUnique({ where: { id: params.commentId } });
  if (!comment) {
    return NextResponse.json({ data: null, error: { code: "NOT_FOUND", message: "Comment not found" } }, { status: 404 });
  }

  if (comment.authorId !== session.user.id) {
    return NextResponse.json({ data: null, error: { code: "FORBIDDEN", message: "Can only delete own comments" } }, { status: 403 });
  }

  await prisma.comment.delete({ where: { id: params.commentId } });

  return NextResponse.json({ data: { id: params.commentId }, error: null });
}
