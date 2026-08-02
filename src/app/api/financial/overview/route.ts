import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { computeOverview } from "@/lib/financial/overview-service";
import { mapFinancialError } from "@/lib/financial/http";
import type { ContractStatus, InstallmentStatus } from "@/lib/financial/types";

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }

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

    const data = await computeOverview({
      period,
      from,
      to,
      clientId,
      contractStatus,
      projectId,
      installmentStatus,
    });

    return NextResponse.json({ data, error: null });
  } catch (error) {
    return mapFinancialError(error);
  }
}
