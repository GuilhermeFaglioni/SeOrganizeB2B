import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getSuperAdminStatus } from "@/lib/admin/super-admin";
import { prisma } from "../../../../../../prisma/client";

async function requireSuperAdmin() {
  const user = await getUser();
  if (!user) return NextResponse.json({ data: null, error: { code: "AUTH_ERROR" } }, { status: 401 });
  if (!(await getSuperAdminStatus(user.id))) return NextResponse.json({ data: null, error: { code: "FORBIDDEN" } }, { status: 403 });
  return user;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireSuperAdmin();
  if (gate instanceof NextResponse) return gate;
  const { id } = await context.params;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ data: null, error: { code: "VALIDATION_ERROR" } }, { status: 400 }); }
  if (!body || typeof body !== "object" || typeof (body as { isActive?: unknown }).isActive !== "boolean") {
    return NextResponse.json({ data: null, error: { code: "VALIDATION_ERROR", message: "isActive must be a boolean" } }, { status: 400 });
  }
  const entry = await prisma.aiModelCatalogEntry.update({ where: { id }, data: { isActive: (body as { isActive: boolean }).isActive } });
  return NextResponse.json({ data: entry, error: null });
}
