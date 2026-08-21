import { NextRequest, NextResponse } from "next/server";
import { prisma, withTenant } from "../../../../../../prisma/client";
import { getUser } from "@/lib/supabase/server";
import { denyFor } from "@/lib/authz/authz";
import { getTenantContext } from "@/lib/authz/tenant-context";
import { noWorkspaceResponse } from "@/lib/authz/http";

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }
  const denied = await denyFor(user.id, "manage_roles");
  if (denied) return denied;

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

  const body = await request.json();
  const { areaIds } = body as { areaIds: string[] };

  return withTenant(ctx.tenantId, async () => {
    const target = await prisma.profile.findUnique({
      where: { id: params.id },
      select: { tenantId: true },
    });
    if (!target || target.tenantId !== ctx.tenantId) {
      return NextResponse.json(
        { data: null, error: { code: "NOT_FOUND", message: "User not found" } },
        { status: 404 }
      );
    }

    await prisma.teamMemberArea.deleteMany({ where: { userId: params.id } });

    if (areaIds.length > 0) {
      await prisma.teamMemberArea.createMany({
        data: areaIds.map((areaId) => ({
          userId: params.id,
          areaId,
          tenantId: ctx.tenantId!,
        })),
      });
    }

    const memberships = await prisma.teamMemberArea.findMany({
      where: { userId: params.id },
      include: { area: { select: { id: true, name: true, color: true } } },
    });

    return NextResponse.json({ data: memberships, error: null });
  });
}
