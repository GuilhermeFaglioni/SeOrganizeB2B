import { NextRequest, NextResponse } from "next/server";
import { prisma, withTenant } from "../../../../../../../prisma/client";
import { denyFor } from "@/lib/authz/authz";
import { getTenantContext } from "@/lib/authz/tenant-context";
import { noWorkspaceResponse } from "@/lib/authz/http";
import { getUser } from "@/lib/supabase/server";
import { reindexColumns } from "@/lib/reorder";

export async function PUT(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }

  const denied = await denyFor(user.id, "projects.edit");
  if (denied) return denied;

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

  const body = await request.json();
  const { orderedIds } = body;

  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return NextResponse.json({ data: null, error: { code: "VALIDATION_ERROR", message: "orderedIds array is required" } }, { status: 400 });
  }

  const updates = reindexColumns(orderedIds);

  const results = await withTenant(ctx.tenantId, () =>
    prisma.$transaction(
      updates.map(({ id, position }) =>
        prisma.projectColumn.update({
          where: { id },
          data: { position },
        })
      )
    )
  );

  return NextResponse.json({ data: results, error: null });
}
