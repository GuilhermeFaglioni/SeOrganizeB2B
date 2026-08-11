import { NextRequest, NextResponse } from "next/server";
import { prisma, withTenant } from "../../../../../prisma/client";
import { denyFor } from "@/lib/authz/authz";
import { getTenantContext } from "@/lib/authz/tenant-context";
import { noWorkspaceResponse } from "@/lib/authz/http";
import { getUser } from "@/lib/supabase/server";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }

  const denied = await denyFor(user.id, "areas.edit");
  if (denied) return denied;

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

  const body = await request.json();
  const { name, color } = body;

  return withTenant(ctx.tenantId, async () => {
    const area = await prisma.teamArea.findFirst({
      where: { id: params.id, tenantId: ctx.tenantId! },
    });
    if (!area) {
      return NextResponse.json({ data: null, error: { code: "NOT_FOUND", message: "Area not found" } }, { status: 404 });
    }

    if (name && name !== area.name) {
      const existing = await prisma.teamArea.findFirst({
        where: { name, tenantId: ctx.tenantId! },
      });
      if (existing) {
        return NextResponse.json({ data: null, error: { code: "CONFLICT", message: "Area name already exists" } }, { status: 409 });
      }
    }

    const updated = await prisma.teamArea.update({
      where: { id: params.id },
      data: { ...(name && { name }), ...(color && { color }) },
    });

    return NextResponse.json({ data: updated, error: null });
  });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }

  const denied = await denyFor(user.id, "areas.delete");
  if (denied) return denied;

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

  return withTenant(ctx.tenantId, async () => {
    const area = await prisma.teamArea.findFirst({
      where: { id: params.id, tenantId: ctx.tenantId! },
    });
    if (!area) {
      return NextResponse.json({ data: null, error: { code: "NOT_FOUND", message: "Area not found" } }, { status: 404 });
    }

    await prisma.task.updateMany({ where: { areaId: params.id }, data: { areaId: null } });
    await prisma.project.updateMany({ where: { areaId: params.id }, data: { areaId: null } });
    await prisma.teamArea.delete({ where: { id: params.id } });

    return NextResponse.json({ data: { id: params.id }, error: null });
  });
}
