import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { refundInstallment } from "@/lib/financial/installments-service";
import { isCivilDate } from "@/lib/financial/civil-date";
import {
  FinancialConflictError,
  FinancialValidationError,
} from "@/lib/financial/lifecycle";

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
    if (error instanceof FinancialValidationError) {
      return NextResponse.json(
        {
          data: null,
          error: { code: "VALIDATION_ERROR", message: error.message },
        },
        { status: 400 }
      );
    }
    if (error instanceof FinancialConflictError) {
      return NextResponse.json(
        {
          data: null,
          error: { code: "CONFLICT", message: error.message },
        },
        { status: 409 }
      );
    }
    throw error;
  }
}
