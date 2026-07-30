import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../prisma/client";
import { getUser } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      {
        data: null,
        error: { code: "AUTH_ERROR", message: "Unauthorized" },
      },
      { status: 401 }
    );
  }

  const requestedLimit = Number(new URL(request.url).searchParams.get("limit"));
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 50)
    : 10;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const tasks = await prisma.task.findMany({
    where: {
      archived: false,
      dueDate: { gte: startOfToday },
      assignees: { some: { profileId: user.id } },
    },
    orderBy: { dueDate: "asc" },
    take: limit,
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
    },
  });

  return NextResponse.json({ data: tasks, error: null });
}
