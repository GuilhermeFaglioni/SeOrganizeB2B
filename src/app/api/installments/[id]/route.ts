import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import {
  cancelInstallment,
  recordPayment,
} from "@/lib/financial/installments-service";
import { isCivilDate } from "@/lib/financial/civil-date";
import {
  FinancialConflictError,
  FinancialValidationError,
} from "@/lib/financial/lifecycle";

export async function PATCH(
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

  try {
    if (body.action === "pay") {
      const paidAt = body.paidAt ?? new Date().toISOString().slice(0, 10);
      if (!isCivilDate(paidAt)) {
        return NextResponse.json(
          {
            data: null,
            error: {
              code: "VALIDATION_ERROR",
              message: "A valid payment date is required",
            },
          },
          { status: 400 }
        );
      }
      const installment = await recordPayment(params.id, paidAt, user.id);
      return NextResponse.json({ data: installment, error: null });
    }
    if (body.action === "cancel") {
      const installment = await cancelInstallment(params.id, user.id);
      return NextResponse.json({ data: installment, error: null });
    }
    return NextResponse.json(
      {
        data: null,
        error: {
          code: "VALIDATION_ERROR",
          message: "Unknown installment action",
        },
      },
      { status: 400 }
    );
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
