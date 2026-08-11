import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { withTenant } from "../../../../../prisma/client";
import { computeOverview } from "@/lib/financial/overview-service";
import { mapFinancialError } from "@/lib/financial/http";
import { denyFor } from "@/lib/authz/authz";
import { applyScopeFilter } from "@/lib/authz/scope-filter";
import { getTenantContext } from "@/lib/authz/tenant-context";
import { noWorkspaceResponse } from "@/lib/authz/http";
import { applyFeatureGate } from "@/lib/middleware/feature-gating";
import type { ContractStatus, InstallmentStatus } from "@/lib/financial/types";

export async function GET(request: NextRequest) {
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

  const gate = await applyFeatureGate({
    userId: user.id,
    pathname: "/api/financial/overview",
    method: "GET",
    tenantContext: ctx,
  });
  if (gate.response) return gate.response;

  try {
    const { searchParams } = request.nextUrl;
    const periodRaw = searchParams.get("period") || "currentMonth";
    const period = (["currentMonth", "next90", "custom"] as const).includes(
      periodRaw as "currentMonth" | "next90" | "custom"
    )
      ? (periodRaw as "currentMonth" | "next90" | "custom")
      : "currentMonth";
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;
    const clientId = searchParams.get("clientId") || undefined;
    const contractStatus = (searchParams.get("contractStatus") ||
      undefined) as ContractStatus | undefined;
    const projectId = searchParams.get("projectId") || undefined;
    const installmentStatus = (searchParams.get("installmentStatus") ||
      undefined) as InstallmentStatus | undefined;

    const data = await withTenant(ctx.tenantId, async () => {
      // Financial overview has no area/project linkage, so area/project scope
      // falls back to tenant-level filtering (see scope-filter.ts).
      const scopeWhere = await applyScopeFilter(
        user.id,
        ctx.tenantId,
        "overview",
        {}
      );
      return computeOverview({
        period,
        from,
        to,
        clientId,
        contractStatus,
        projectId,
        installmentStatus,
        contractWhere: scopeWhere,
      });
    });

    return NextResponse.json({ data, error: null });
  } catch (error) {
    return mapFinancialError(error);
  }
}
