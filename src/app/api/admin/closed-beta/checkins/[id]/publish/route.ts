import { NextResponse } from "next/server";
import { requireClosedBetaAdmin } from "@/lib/closed-beta/admin";
import { mapCheckinError } from "@/lib/closed-beta/checkin-http";
import { publishCheckinEdition } from "@/lib/closed-beta/checkin";

export const dynamic = "force-dynamic";

function badRequest(message: string) {
  return NextResponse.json(
    { data: null, error: { code: "VALIDATION_ERROR", message } },
    { status: 400 },
  );
}

function parseDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") throw new Error("not-a-date");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("not-a-date");
  return date;
}

export async function POST(
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

  const body = await request.json().catch(() => null);
  let opensAt: Date | null | undefined;
  let closesAt: Date | null | undefined;
  if (body && typeof body === "object" && !Array.isArray(body)) {
    try {
      opensAt = parseDate((body as Record<string, unknown>).opensAt);
      closesAt = parseDate((body as Record<string, unknown>).closesAt);
    } catch {
      return badRequest("opensAt and closesAt must be ISO date strings or null");
    }
  }

  try {
    const edition = await publishCheckinEdition(
      params.id,
      { opensAt, closesAt },
      { userId: gate.user.id, email: gate.user.email ?? "" },
    );
    return NextResponse.json({ data: edition, error: null });
  } catch (error) {
    return mapCheckinError(error, "Unable to publish check-in edition");
  }
}
