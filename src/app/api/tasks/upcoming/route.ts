import { NextRequest, NextResponse } from "next/server";
import { prisma, withTenant } from "../../../../../prisma/client";
import { denyFor } from "@/lib/authz/authz";
import { applyScopeFilter } from "@/lib/authz/scope-filter";
import { getTenantContext } from "@/lib/authz/tenant-context";
import { noWorkspaceResponse } from "@/lib/authz/http";
import { applyFeatureGate } from "@/lib/middleware/feature-gating";
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

  const denied = await denyFor(user.id, "tasks.view");
  if (denied) return denied;

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

  const gate = await applyFeatureGate({
    userId: user.id,
    pathname: "/api/tasks/upcoming",
    method: "GET",
    tenantContext: ctx,
  });
  if (gate.response) return gate.response;

  const requestedLimit = Number(new URL(request.url).searchParams.get("limit"));
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 50)
    : 10;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const where = await applyScopeFilter(user.id, ctx.tenantId, "task", {
    archived: false,
    dueDate: { gte: startOfToday },
    assignees: { some: { profileId: user.id } },
  });

  const tasks = await withTenant(ctx.tenantId, () =>
    prisma.task.findMany({
      where,
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
    })
  );

  return NextResponse.json({ data: tasks, error: null });
}
