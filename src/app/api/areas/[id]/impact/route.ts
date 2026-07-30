import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../../prisma/client";
import { getUser } from "@/lib/supabase/server";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }

  const [tasks, projects] = await Promise.all([
    prisma.task.count({ where: { areaId: params.id } }),
    prisma.project.count({ where: { areaId: params.id } }),
  ]);

  return NextResponse.json({ data: { tasks, projects }, error: null });
}
