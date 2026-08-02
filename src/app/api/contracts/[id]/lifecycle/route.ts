import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import {
  activateContract,
  applyLifecycleAction,
} from "@/lib/financial/contracts-service";
import { isCivilDate } from "@/lib/financial/civil-date";
import { mapFinancialError } from "@/lib/financial/http";

const ACTIONS = [
  "activate",
  "suspend",
  "resume",
  "close",
  "cancel",
  "renew",
] as const;

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
  const action = body.action;

  if (!ACTIONS.includes(action)) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: "VALIDATION_ERROR",
          message: "Unknown lifecycle action",
        },
      },
      { status: 400 }
    );
  }

  try {
    if (action === "activate") {
      const plan = body.plan;
      if (!Array.isArray(plan) || plan.length === 0) {
        return NextResponse.json(
          {
            data: null,
            error: {
              code: "VALIDATION_ERROR",
              message: "An installment plan is required",
            },
          },
          { status: 400 }
        );
      }
      for (const item of plan) {
        if (!isCivilDate(item.dueDate)) {
          return NextResponse.json(
            {
              data: null,
              error: {
                code: "VALIDATION_ERROR",
                message: "Each installment needs a valid due date",
              },
            },
            { status: 400 }
          );
        }
        if (isNaN(Number(item.expectedAmount))) {
          return NextResponse.json(
            {
              data: null,
              error: {
                code: "VALIDATION_ERROR",
                message: "Each installment needs a valid amount",
              },
            },
            { status: 400 }
          );
        }
      }
      const contract = await activateContract(params.id, plan, user.id);
      return NextResponse.json({ data: contract, error: null });
    }

    if (
      action === "cancel" &&
      !isCivilDate(body.effectiveDate ?? "")
    ) {
      return NextResponse.json(
        {
          data: null,
          error: {
            code: "VALIDATION_ERROR",
            message: "An effective date is required to cancel",
          },
        },
        { status: 400 }
      );
    }

    const contract = await applyLifecycleAction(
      params.id,
      action,
      {
        effectiveDate: body.effectiveDate ?? undefined,
        retainedInstallmentIds: body.retainedInstallmentIds ?? [],
      },
      user.id
    );
    return NextResponse.json({ data: contract, error: null });
  } catch (error) {
    return mapFinancialError(error);
  }
}
