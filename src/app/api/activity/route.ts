import { NextRequest, NextResponse } from "next/server";
import { prisma, withTenant } from "../../../../prisma/client";
import { getUser } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/authz/tenant-context";
import { noWorkspaceResponse } from "@/lib/authz/http";

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get("taskId");
  const limit = Math.min(
    Math.max(Number(searchParams.get("limit")) || 20, 1),
    100
  );

  return withTenant(ctx.tenantId, async () => {
    if (taskId) {
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: { id: true },
      });
      if (!task) {
        return NextResponse.json(
          { data: null, error: { code: "NOT_FOUND", message: "Task not found" } },
          { status: 404 }
        );
      }
    }

    const activities = await prisma.activity.findMany({
      where: taskId
        ? { taskId }
        : {
            OR: [
              { actorId: user.id },
              { task: { assignees: { some: { profileId: user.id } } } },
              {
                notifications: {
                  some: { recipientId: user.id },
                },
              },
            ],
          },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        actor: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    return NextResponse.json({ data: activities, error: null });
  });
}
