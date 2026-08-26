import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getSuperAdminStatus } from "@/lib/admin/super-admin";
import { aiObservabilityCsv, getAIObservabilityReport, type AIObservabilityFilters } from "@/lib/ai/admin-observability";

export const dynamic = "force-dynamic";

function parseDate(value: string | null): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

async function gate() {
  const user = await getUser();
  if (!user) return NextResponse.json({ data: null, error: { code: "AUTH_ERROR" } }, { status: 401 });
  if (!(await getSuperAdminStatus(user.id))) return NextResponse.json({ data: null, error: { code: "FORBIDDEN" } }, { status: 403 });
  return null;
}

function filters(request: NextRequest): AIObservabilityFilters {
  const query = request.nextUrl.searchParams;
  return { from: parseDate(query.get("from")), to: parseDate(query.get("to")), planId: query.get("planId") || undefined, provider: query.get("provider") || undefined, model: query.get("model") || undefined, tenantId: query.get("tenantId") || undefined };
}

export async function GET(request: NextRequest) {
  const denied = await gate();
  if (denied) return denied;
  const report = await getAIObservabilityReport(filters(request));
  if (request.nextUrl.searchParams.get("format") === "csv") {
    return new NextResponse(aiObservabilityCsv(report), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=ai-observability.csv" } });
  }
  return NextResponse.json({ data: report, error: null });
}
