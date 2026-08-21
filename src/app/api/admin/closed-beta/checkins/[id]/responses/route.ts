import { NextResponse } from "next/server";
import { requireClosedBetaAdmin } from "@/lib/closed-beta/admin";
import { CheckinNotFoundError } from "@/lib/closed-beta/checkin";
import {
  exportCheckinResponses,
  getCheckinEditionMetrics,
  getCheckinResponseDetail,
  getCheckinResponseGrouping,
  listCheckinResponses,
} from "@/lib/closed-beta/responses";

export const dynamic = "force-dynamic";

function parseDate(value: string | null, endOfDay = false): Date | undefined {
  if (!value) return undefined;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(
    endOfDay && dateOnly ? `${value}T23:59:59.999Z` : value,
  );
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;
  const gate = await requireClosedBetaAdmin();
  if (!gate.ok) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: gate.reason === "unauthorized" ? "AUTH_ERROR" : "FORBIDDEN",
          message: gate.reason === "unauthorized" ? "Unauthorized" : "Forbidden",
        },
      },
      { status: gate.reason === "unauthorized" ? 401 : 403 },
    );
  }
  const url = new URL(request.url);
  const workspaceId = url.searchParams.get("workspaceId") ?? undefined;
  const theme = url.searchParams.get("theme") ?? undefined;
  const from = parseDate(url.searchParams.get("from"));
  const to = parseDate(url.searchParams.get("to"), true);
  const mode = url.searchParams.get("mode") ?? "list";

  try {
    let data: unknown;
    if (mode === "grouped") {
      data = await getCheckinResponseGrouping(params.id);
    } else if (mode === "metrics") {
      data = await getCheckinEditionMetrics(params.id);
    } else if (mode === "export") {
      data = await exportCheckinResponses(params.id);
    } else if (mode === "detail") {
      const detailWorkspaceId = url.searchParams.get("workspaceId");
      if (!detailWorkspaceId) {
        return NextResponse.json(
          { data: null, error: { code: "VALIDATION_ERROR", message: "workspaceId is required" } },
          { status: 400 },
        );
      }
      data = await getCheckinResponseDetail(params.id, detailWorkspaceId);
    } else {
      data = await listCheckinResponses({
        editionId: params.id,
        ...(workspaceId ? { workspaceId } : {}),
        ...(theme ? { theme } : {}),
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
      });
    }
    return NextResponse.json({ data, error: null });
  } catch (error) {
    if (error instanceof CheckinNotFoundError) {
      return NextResponse.json(
        { data: null, error: { code: "NOT_FOUND", message: error.message } },
        { status: 404 },
      );
    }
    console.error("Check-in responses load failed:", error);
    return NextResponse.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Unable to load responses" } },
      { status: 500 },
    );
  }
}
