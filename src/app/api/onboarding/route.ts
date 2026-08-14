import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/authz/tenant-context";
import { prisma, withTenant } from "../../../../prisma/client";

function unauthorized() {
  return NextResponse.json(
    { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
    { status: 401 },
  );
}

function notFound() {
  return NextResponse.json(
    { data: null, error: { code: "NOT_FOUND", message: "Workspace not found" } },
    { status: 404 },
  );
}

export async function POST() {
  const user = await getUser();
  if (!user) return unauthorized();

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return notFound();

  const workspace = await prisma.workspace.findUnique({
    where: { id: ctx.tenantId },
    select: { onboardingCompleted: true, companyName: true },
  });
  if (!workspace) return notFound();

  if (workspace.onboardingCompleted) {
    return NextResponse.json({ data: { onboardingCompleted: true }, error: null });
  }

  const [activeClients, proposals, contracts, projectsWithTasks] = await withTenant(
    ctx.tenantId,
    () =>
      Promise.all([
        prisma.client.count({ where: { active: true, tenantId: ctx.tenantId! } }),
        prisma.proposal.count({ where: { tenantId: ctx.tenantId! } }),
        prisma.contract.count({ where: { tenantId: ctx.tenantId! } }),
        prisma.project.count({
          where: {
            archived: false,
            tasks: { some: {} },
            tenantId: ctx.tenantId!,
          },
        }),
      ]),
  );

  const complete =
    Boolean(workspace.companyName?.trim()) &&
    activeClients > 0 &&
    (proposals > 0 || contracts > 0) &&
    projectsWithTasks > 0;

  if (!complete) {
    return NextResponse.json({ data: { onboardingCompleted: false }, error: null });
  }

  await prisma.workspace.updateMany({
    where: { id: ctx.tenantId, onboardingCompleted: false },
    data: { onboardingCompleted: true },
  });

  return NextResponse.json({ data: { onboardingCompleted: true }, error: null });
}
