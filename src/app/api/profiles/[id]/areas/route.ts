import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../../prisma/client";
import { getSession } from "@/lib/supabase/server";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }

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
