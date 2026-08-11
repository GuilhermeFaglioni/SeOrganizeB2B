import { NextResponse } from "next/server";
import { prisma, withTenant } from "../../../../../prisma/client";
import { getUser } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/authz/tenant-context";
import { noWorkspaceResponse } from "@/lib/authz/http";

export async function PATCH(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

  const result = await withTenant(ctx.tenantId, () =>
    prisma.notification.updateMany({
      where: { id: params.id, recipientId: user.id },
      data: { readAt: new Date() },
    })
  );
  if (result.count === 0) {
    return NextResponse.json(
      {
        data: null,
        error: { code: "NOT_FOUND", message: "Notification not found" },
      },
      { status: 404 }
    );
  }
  return NextResponse.json({ data: { id: params.id }, error: null });
}
