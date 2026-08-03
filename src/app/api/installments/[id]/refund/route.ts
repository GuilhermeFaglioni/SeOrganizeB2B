import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { refundInstallment } from "@/lib/financial/installments-service";
import { isCivilDate } from "@/lib/financial/civil-date";
import { mapFinancialError } from "@/lib/financial/http";
import { denyFor } from "@/lib/authz/authz";

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
  const denied = await denyFor(user.id, "financial.receivables.refund");
  if (denied) return denied;

  const body = await request.json();

  if (
    typeof body.refundAmount !== "string" ||
    isNaN(Number(body.refundAmount))
  ) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: "VALIDATION_ERROR",
          message: "A numeric refund amount is required",
        },
      },
      { status: 400 }
    );
  }
  const refundDate = body.refundDate ?? new Date().toISOString().slice(0, 10);
  if (!isCivilDate(refundDate)) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: "VALIDATION_ERROR",
          message: "A valid refund date is required",
        },
      },
      { status: 400 }
    );
  }

  try {
    const refund = await refundInstallment(
      params.id,
      body.refundAmount,
      refundDate,
      user.id
    );
    return NextResponse.json({ data: refund, error: null }, { status: 201 });
  } catch (error) {
    return mapFinancialError(error);
  }
}
