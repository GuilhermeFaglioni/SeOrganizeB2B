import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { prisma, withTenant } from "../../../../prisma/client";

function unauthorized() {
  return NextResponse.json(
    { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
    { status: 401 }
  );
}

function notFound() {
  return NextResponse.json(
    { data: null, error: { code: "NOT_FOUND", message: "Workspace not found" } },
    { status: 404 }
  );
}

async function getWorkspaceForUser(userId: string) {
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: {
      tenant: {
        include: {
          plan: {
            include: { planLimits: true },
          },
        },
      },
    },
  });
  return profile?.tenant ?? null;
}

async function computeUsage(tenantId: string) {
  return withTenant(tenantId, async () => {
    const [users, tasks, projects, contracts] = await Promise.all([
      prisma.profile.count({ where: { tenantId } }),
      prisma.task.count({ where: { tenantId } }),
      prisma.project.count({ where: { tenantId } }),
      prisma.contract.count({ where: { tenantId } }),
    ]);
    return { users, tasks, projects, contracts };
  });
}

export async function GET() {
  const user = await getUser();
  if (!user) return unauthorized();

  const workspace = await getWorkspaceForUser(user.id);
  if (!workspace) return notFound();

  const usage = await computeUsage(workspace.id);
  const allowedModules = (workspace.plan?.allowedModules as string[]) ?? [];
  const planLimits = workspace.plan?.planLimits ?? [];

  const limits: Record<string, { limit: number; remaining: number; behavior: string }> = {};
  for (const planLimit of planLimits) {
    const used = (usage as Record<string, number>)[planLimit.resource] ?? 0;
    limits[planLimit.resource] = {
      limit: planLimit.limit,
      remaining: planLimit.limit - used,
      behavior: planLimit.behavior,
    };
  }

  return NextResponse.json({
    data: {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      logoUrl: workspace.logoUrl,
      companyName: workspace.companyName,
      status: workspace.status,
      gracePeriodEndsAt: workspace.gracePeriodEndsAt,
      plan: workspace.plan
        ? {
            id: workspace.plan.id,
            name: workspace.plan.name,
            allowedModules,
          }
        : null,
      features: {
        allowedModules,
        limits,
        usage,
      },
    },
    error: null,
  });
}