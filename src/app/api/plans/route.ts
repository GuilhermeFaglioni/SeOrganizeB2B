import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { prisma } from "../../../../prisma/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const plans = await prisma.plan.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      allowedModules: true,
      stripePriceId: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    data: plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      allowedModules: (plan.allowedModules as string[]) ?? [],
      stripePriceId: plan.stripePriceId,
    })),
    error: null,
  });
}