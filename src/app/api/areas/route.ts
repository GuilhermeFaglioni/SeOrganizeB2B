import { NextRequest, NextResponse } from "next/server";
import { prisma, withTenant } from "../../../../prisma/client";
import { denyFor } from "@/lib/authz/authz";
import { getTenantContext } from "@/lib/authz/tenant-context";
import { noWorkspaceResponse } from "@/lib/authz/http";
import { getUser } from "@/lib/supabase/server";

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }

  const denied = await denyFor(user.id, "areas.view");
  if (denied) return denied;

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

  return withTenant(ctx.tenantId, async () => {
    const areas = await prisma.teamArea.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { tasks: true, memberAreas: true } },
      },
    });

    return NextResponse.json({ data: areas, error: null });
  });
}

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }

  const denied = await denyFor(user.id, "areas.create");
  if (denied) return denied;

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

  const body = await request.json();
  const { name, color } = body;

  if (!name || typeof name !== "string") {
    return NextResponse.json({ data: null, error: { code: "VALIDATION_ERROR", message: "Name is required" } }, { status: 400 });
  }

  return withTenant(ctx.tenantId, async () => {
    const existing = await prisma.teamArea.findFirst({
      where: { name, tenantId: ctx.tenantId! },
    });
    if (existing) {
      return NextResponse.json({ data: null, error: { code: "CONFLICT", message: "Area name already exists" } }, { status: 409 });
    }

    const area = await prisma.teamArea.create({
      data: {
        name,
        color: color || "#3b82f6",
        createdBy: user.id,
        tenantId: ctx.tenantId!,
      },
    });

    return NextResponse.json({ data: area, error: null }, { status: 201 });
  });
}
