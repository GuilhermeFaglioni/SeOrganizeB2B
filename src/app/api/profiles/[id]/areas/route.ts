import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../../prisma/client";
import { getUser } from "@/lib/supabase/server";
import { denyFor } from "@/lib/authz/authz";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }
  const denied = await denyFor(user.id, "manage_roles");
  if (denied) return denied;

  const body = await request.json();
  const { areaIds } = body as { areaIds: string[] };

  await prisma.teamMemberArea.deleteMany({ where: { userId: params.id } });

  if (areaIds.length > 0) {
    await prisma.teamMemberArea.createMany({
      data: areaIds.map((areaId) => ({
        userId: params.id,
        areaId,
      })),
    });
  }

  const memberships = await prisma.teamMemberArea.findMany({
    where: { userId: params.id },
    include: { area: { select: { id: true, name: true, color: true } } },
  });

  return NextResponse.json({ data: memberships, error: null });
}
