import { NextRequest, NextResponse } from "next/server";
import { prisma, withTenant } from "../../../../../../prisma/client";
import { denyFor } from "@/lib/authz/authz";
import { getTenantContext } from "@/lib/authz/tenant-context";
import { noWorkspaceResponse } from "@/lib/authz/http";
import { applyFeatureGate, withFeatureWarning } from "@/lib/middleware/feature-gating";
import { getUser } from "@/lib/supabase/server";

export async function PATCH(request: NextRequest, { params }: { params: { projectId: string } }) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }

  const denied = await denyFor(user.id, "projects.edit");
  if (denied) return denied;

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

  const gate = await applyFeatureGate({
    userId: user.id,
    pathname: "/api/projects/[projectId]/auto-assign",
    method: "PATCH",
    tenantContext: ctx,
  });
  if (gate.response) return gate.response;

  let body: { enabled?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { data: null, error: { code: "VALIDATION_ERROR", message: "Invalid JSON body" } },
      { status: 400 }
    );
  }

  if (typeof body.enabled !== "boolean") {
    return NextResponse.json(
      { data: null, error: { code: "VALIDATION_ERROR", message: "enabled must be a boolean" } },
      { status: 400 }
    );
  }

  const enabled = body.enabled;

  return withTenant(ctx.tenantId, async () => {
    const project = await prisma.project.findFirst({
      where: { id: params.projectId, tenantId: ctx.tenantId! },
    });
    if (!project) {
      return NextResponse.json(
        { data: null, error: { code: "NOT_FOUND", message: "Project not found" } },
        { status: 404 }
      );
    }

    let added = 0;
    let removed = 0;

    if (enabled) {
      const areaMembers = project.areaId
        ? await prisma.teamMemberArea.findMany({
            where: { areaId: project.areaId },
            select: { userId: true },
          })
        : [];
      if (areaMembers.length > 0) {
        const result = await prisma.projectMember.createMany({
          data: areaMembers.map((member) => ({
            projectId: params.projectId,
            profileId: member.userId,
            autoAssignedByArea: true,
          })),
          skipDuplicates: true,
        });
        added = result.count;
      }
    } else {
      const result = await prisma.projectMember.deleteMany({
        where: { projectId: params.projectId, autoAssignedByArea: true },
      });
      removed = result.count;
    }

    return withFeatureWarning(
      NextResponse.json({
        data: {
          id: project.id,
          name: project.name,
          areaId: project.areaId,
          autoAssignedByArea: enabled,
          added,
          removed,
        },
        error: null,
      }),
      gate.warning
    );
  });
}