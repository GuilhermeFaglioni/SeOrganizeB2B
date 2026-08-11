import { NextResponse } from "next/server";
import { prisma } from "../../../../prisma/client";
import { getUser } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/authz/tenant-context";
import { noWorkspaceResponse } from "@/lib/authz/http";

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

  const profiles = await prisma.profile.findMany({
    where: { tenantId: ctx.tenantId },
    select: { id: true, name: true, email: true, avatarUrl: true, teamMemberAreas: { include: { area: { select: { id: true, name: true, color: true } } } } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ data: profiles, error: null });
}
