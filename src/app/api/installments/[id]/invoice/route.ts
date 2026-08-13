import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { withTenant } from "../../../../../../prisma/client";
import { getInvoiceData } from "@/lib/financial/invoice-service";
import { mapFinancialError } from "@/lib/financial/http";
import { denyFor } from "@/lib/authz/authz";
import { getTenantContext } from "@/lib/authz/tenant-context";
import { noWorkspaceResponse } from "@/lib/authz/http";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      {
        data: null,
        error: { code: "AUTH_ERROR", message: "Unauthorized" },
      },
      { status: 401 }
    );
  }
  const denied = await denyFor(user.id, "financial.receivables.view");
  if (denied) return denied;

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

  try {
    const invoice = await withTenant(ctx.tenantId, () =>
      getInvoiceData(params.id, ctx.tenantId!)
    );
    return NextResponse.json({ data: invoice, error: null });
  } catch (error) {
    return mapFinancialError(error);
  }
}
