import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getSuperAdminStatus } from "@/lib/admin/super-admin";
import { prisma } from "../../../../../../prisma/client";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getUser(); if (!user) return NextResponse.json({ data: null, error: { code: "AUTH_ERROR" } }, { status: 401 });
  if (!(await getSuperAdminStatus(user.id))) return NextResponse.json({ data: null, error: { code: "FORBIDDEN" } }, { status: 403 });
  const body = await request.json().catch(() => null) as { isActive?: unknown } | null;
  if (typeof body?.isActive !== "boolean") return NextResponse.json({ data: null, error: { code: "VALIDATION_ERROR" } }, { status: 400 });
  return NextResponse.json({ data: await prisma.aiCreditPackage.update({ where: { id: (await context.params).id }, data: { isActive: body.isActive } }), error: null });
}
