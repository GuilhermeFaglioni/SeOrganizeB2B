import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { withTenant } from "../../../../../../prisma/client";
import { rejectProposal } from "@/lib/financial/proposals-service";
import { mapFinancialError } from "@/lib/financial/http";
import { denyFor } from "@/lib/authz/authz";
import { getTenantContext } from "@/lib/authz/tenant-context";
import { noWorkspaceResponse } from "@/lib/authz/http";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }
  const denied = await denyFor(user.id, "financial.proposals.acceptReject");
  if (denied) return denied;

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

  const body = await request.json().catch(() => ({}));
  try {
    const proposal = await withTenant(ctx.tenantId, () =>
      rejectProposal(
        params.id,
        typeof body.reason === "string" ? body.reason : null
      )
    );
    return NextResponse.json({ data: proposal, error: null });
  } catch (error) {
    return mapFinancialError(error);
  }
}
