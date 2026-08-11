import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { withTenant } from "../../../../../../prisma/client";
import { cloneProposal } from "@/lib/financial/proposals-service";
import { mapFinancialError } from "@/lib/financial/http";
import { denyFor } from "@/lib/authz/authz";
import { getTenantContext } from "@/lib/authz/tenant-context";
import { noWorkspaceResponse } from "@/lib/authz/http";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }
  const denied = await denyFor(user.id, "financial.proposals.clone");
  if (denied) return denied;

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

  try {
    const proposal = await withTenant(ctx.tenantId, () =>
      cloneProposal(params.id, user.id)
    );
    return NextResponse.json({ data: proposal, error: null }, { status: 201 });
  } catch (error) {
    return mapFinancialError(error);
  }
}
