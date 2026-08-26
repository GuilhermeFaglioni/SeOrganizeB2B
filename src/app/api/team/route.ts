import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { denyFor } from "@/lib/authz/authz";
import { listTeam } from "@/lib/authz/roles-service";
import { getTenantContext } from "@/lib/authz/tenant-context";
import { noWorkspaceResponse } from "@/lib/authz/http";
import { listMemberCreditLimits } from "@/lib/ai/member-credit-limits";

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }
  const denied = await denyFor(user.id, "manage_roles");
  if (denied) return denied;

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

   const [team, limits] = await Promise.all([listTeam(ctx.tenantId), listMemberCreditLimits(ctx.tenantId)]);
   const byProfile = new Map(limits.map((limit) => [limit.profileId, limit.monthlyLimit]));
   return NextResponse.json({ data: team.map((member) => ({ ...member, monthlyCreditLimit: byProfile.get(member.id) ?? null })), error: null });
}
