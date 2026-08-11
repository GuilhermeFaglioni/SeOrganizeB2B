import { NextResponse } from "next/server";
import { prisma, withTenant } from "../../../../../prisma/client";
import { denyFor } from "@/lib/authz/authz";
import { applyScopeFilter } from "@/lib/authz/scope-filter";
import { getTenantContext } from "@/lib/authz/tenant-context";
import { noWorkspaceResponse } from "@/lib/authz/http";
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

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const where = await applyScopeFilter(user.id, ctx.tenantId, "task", {
    archived: false,
    dueDate: { lte: endOfToday },
    assignees: { some: { profileId: user.id } },
    column: { completesTasks: false },
  });
  const tasks = await withTenant(ctx.tenantId, () =>
    prisma.task.findMany({
      where,
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
    })
  );
  return NextResponse.json({ data: tasks, error: null });
}
