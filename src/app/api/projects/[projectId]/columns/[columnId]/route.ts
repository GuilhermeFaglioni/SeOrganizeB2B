import { NextRequest, NextResponse } from "next/server";
import { prisma, withTenant } from "../../../../../../../prisma/client";
import { denyFor } from "@/lib/authz/authz";
import { getTenantContext } from "@/lib/authz/tenant-context";
import { noWorkspaceResponse } from "@/lib/authz/http";
import { getUser } from "@/lib/supabase/server";

export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ projectId: string; columnId: string }> }
) {
  const params = await props.params;
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }

  const denied = await denyFor(user.id, "projects.edit");
  if (denied) return denied;

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

  return withTenant(ctx.tenantId, async () => {
    const column = await prisma.projectColumn.findFirst({
      where: { id: params.columnId, tenantId: ctx.tenantId! },
    });
    if (!column) {
      return NextResponse.json({ data: null, error: { code: "NOT_FOUND", message: "Column not found" } }, { status: 404 });
    }

    const body = await request.json();
    const { name, color } = body;

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (color !== undefined) data.color = color;

    const updated = await prisma.projectColumn.update({
      where: { id: params.columnId },
      data,
    });

    return NextResponse.json({ data: updated, error: null });
  });
}

export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ projectId: string; columnId: string }> }
) {
  const params = await props.params;
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }

  const denied = await denyFor(user.id, "projects.edit");
  if (denied) return denied;

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

  return withTenant(ctx.tenantId, async () => {
    const column = await prisma.projectColumn.findFirst({
      where: { id: params.columnId, tenantId: ctx.tenantId! },
      include: { _count: { select: { tasks: true } } },
    });

    if (!column) {
      return NextResponse.json({ data: null, error: { code: "NOT_FOUND", message: "Column not found" } }, { status: 404 });
    }

    if (column._count.tasks > 0) {
      return NextResponse.json({ data: null, error: { code: "CONFLICT", message: "Cannot delete column with existing tasks" } }, { status: 409 });
    }

    await prisma.projectColumn.delete({ where: { id: params.columnId } });

    return NextResponse.json({ data: { id: params.columnId }, error: null });
  });
}
