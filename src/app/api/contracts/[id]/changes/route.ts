import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { applyContractChange } from "@/lib/financial/contracts-service";
import { isCivilDate } from "@/lib/financial/civil-date";
import { mapFinancialError } from "@/lib/financial/http";

export async function POST(
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

  const body = await request.json();

  if (!["upsell", "downsell"].includes(body.type)) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: "VALIDATION_ERROR",
          message: "Type must be upsell or downsell",
        },
      },
      { status: 400 }
    );
  }
  if (!["redistribute", "adjust"].includes(body.strategy)) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: "VALIDATION_ERROR",
          message: "Strategy must be redistribute or adjust",
        },
      },
      { status: 400 }
    );
  }
  if (typeof body.delta !== "string" || isNaN(Number(body.delta))) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: "VALIDATION_ERROR",
          message: "A numeric delta is required",
        },
      },
      { status: 400 }
    );
  }
  if (!isCivilDate(body.effectiveDate ?? "")) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: "VALIDATION_ERROR",
          message: "A valid effective date is required",
        },
      },
      { status: 400 }
    );
  }

  try {
    const result = await applyContractChange(
      params.id,
      {
        type: body.type,
        delta: body.delta,
        effectiveDate: body.effectiveDate,
        description: body.description ?? undefined,
        reason: body.reason ?? undefined,
        strategy: body.strategy,
        confirm: body.confirm === true,
      },
      user.id
    );
    return NextResponse.json({ data: result, error: null });
  } catch (error) {
    return mapFinancialError(error);
  }
}
