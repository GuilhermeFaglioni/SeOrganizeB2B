import { NextResponse } from "next/server";
import { prisma } from "../../../../../prisma/client";
import { denyFor } from "@/lib/authz/authz";
import { getUser } from "@/lib/supabase/server";

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }
  const denied = await denyFor(user.id, "tasks.view");
  if (denied) return denied;

  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const tasks = await prisma.task.findMany({
    where: {
      archived: false,
      dueDate: { lte: endOfToday },
      assignees: { some: { profileId: user.id } },
      column: { completesTasks: false },
    },
    orderBy: [{ dueDate: "asc" }, { priority: "asc" }],
    include: {
      project: { select: { id: true, name: true } },
      area: { select: { id: true, name: true, color: true } },
      assignees: {
        include: {
          profile: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
      },
      _count: { select: { comments: true } },
    },
  });
  return NextResponse.json({ data: tasks, error: null });
}
