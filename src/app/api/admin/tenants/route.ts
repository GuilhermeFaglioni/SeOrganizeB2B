import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getSuperAdminStatus } from "@/lib/admin/super-admin";
import { countWorkspaceUsage } from "@/lib/features";
import { prisma } from "../../../../../prisma/client";

export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json(
    { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
    { status: 401 }
  );
}

function forbidden() {
  return NextResponse.json(
    {
      data: null,
      error: {
        code: "FORBIDDEN",
        message: "Only super-admins can manage tenants",
      },
    },
    { status: 403 }
  );
}

export async function GET() {
  const user = await getUser();
  if (!user) return unauthorized();

  const isSuperAdmin = await getSuperAdminStatus(user.id);
  if (!isSuperAdmin) return forbidden();

  const workspaces = await prisma.workspace.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
    include: { plan: { select: { id: true, name: true } } },
  });

  const data = await Promise.all(
    workspaces.map(async (workspace) => {
      const usage = await countWorkspaceUsage(workspace.id);
      return {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        status: workspace.status,
        plan: workspace.plan
          ? { id: workspace.plan.id, name: workspace.plan.name }
          : null,
        usage: {
          users: usage.users,
          tasks: usage.tasks,
          projects: usage.projects,
        },
        createdAt: workspace.createdAt,
      };
    })
  );

  return NextResponse.json({ data, error: null });
}