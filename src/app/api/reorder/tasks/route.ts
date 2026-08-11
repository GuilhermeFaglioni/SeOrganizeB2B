import { NextRequest, NextResponse } from "next/server";
import { prisma, withTenant } from "../../../../../prisma/client";
import { denyFor } from "@/lib/authz/authz";
import { getTenantContext } from "@/lib/authz/tenant-context";
import { noWorkspaceResponse } from "@/lib/authz/http";
import { getUser } from "@/lib/supabase/server";

export async function PUT(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }

  const denied = await denyFor(user.id, "tasks.edit");
  if (denied) return denied;

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

  const body = await request.json();
  const { updates } = body;

  if (!Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ data: null, error: { code: "VALIDATION_ERROR", message: "Updates array is required" } }, { status: 400 });
  }

  const results = await withTenant(ctx.tenantId, () =>
    prisma.$transaction(
      updates.map((update: { id: string; column_id?: string; position?: number }) =>
        prisma.task.update({
          where: { id: update.id },
          data: {
            ...(update.column_id !== undefined && { columnId: update.column_id }),
            ...(update.position !== undefined && { position: update.position }),
          },
        })
      )
    )
  );

  return NextResponse.json({ data: results, error: null });
}
