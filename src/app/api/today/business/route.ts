import { NextResponse } from "next/server";
import { withTenant } from "../../../../../prisma/client";
import { denyFor } from "@/lib/authz/authz";
import { getTenantContext } from "@/lib/authz/tenant-context";
import { noWorkspaceResponse } from "@/lib/authz/http";
import { getUser } from "@/lib/supabase/server";
import { computeTodayBusiness } from "@/lib/financial/today-business-service";
import { checkAndNotifyInstallments } from "@/lib/financial/installment-notifications";
import { mapFinancialError } from "@/lib/financial/http";

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const denied = await denyFor(user.id, "financial.overview.view");
  if (denied) return denied;

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

  try {
    // Fire-and-forget: check for installment notifications (idempotent).
    // Runs on-demand when the prestador loads the Hoje page.
    // Errors are swallowed — notification failure must not break the page.
    await withTenant(ctx.tenantId, () => checkAndNotifyInstallments()).catch(
      () => {}
    );

    const data = await withTenant(ctx.tenantId, () => computeTodayBusiness());
    return NextResponse.json({ data, error: null });
  } catch (error) {
    return mapFinancialError(error);
  }
}
