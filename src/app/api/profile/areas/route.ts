import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../prisma/client";
import { getUser } from "@/lib/supabase/server";

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

  const body = await request.json();
  const { areaIds } = body as { areaIds: string[] };

  await prisma.teamMemberArea.deleteMany({ where: { userId: user.id } });

  if (areaIds.length > 0) {
    await prisma.teamMemberArea.createMany({
      data: areaIds.map((areaId) => ({
        userId: user.id,
        areaId,
      })),
    });
  }

  const memberships = await prisma.teamMemberArea.findMany({
    where: { userId: user.id },
    include: { area: { select: { id: true, name: true, color: true } } },
  });

  return NextResponse.json({ data: memberships, error: null });
}