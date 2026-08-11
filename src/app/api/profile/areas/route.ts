import { NextRequest, NextResponse } from "next/server";
import { prisma, withTenant } from "../../../../../prisma/client";
import { getUser } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/authz/tenant-context";
import { noWorkspaceResponse } from "@/lib/authz/http";

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    include: {
      teamMemberAreas: {
        include: { area: { select: { id: true, name: true, color: true } } },
      },
    },
  });

  if (!profile) {
    return NextResponse.json({ data: null, error: { code: "NOT_FOUND", message: "Profile not found" } }, { status: 404 });
  }

  return NextResponse.json({ data: profile.teamMemberAreas, error: null });
}

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

  const body = await request.json();
  const { areaIds } = body as { areaIds: string[] };

  return withTenant(ctx.tenantId, async () => {
    await prisma.teamMemberArea.deleteMany({ where: { userId: user.id } });

    if (areaIds.length > 0) {
      await prisma.teamMemberArea.createMany({
        data: areaIds.map((areaId) => ({
          userId: user.id,
          areaId,
          tenantId: ctx.tenantId!,
        })),
      });
    }

    const memberships = await prisma.teamMemberArea.findMany({
      where: { userId: user.id },
      include: { area: { select: { id: true, name: true, color: true } } },
    });

    return NextResponse.json({ data: memberships, error: null });
  });
}