import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { withTenant } from "../../../../../../prisma/client";
import {
  activateContract,
  applyLifecycleAction,
  confirmContract,
} from "@/lib/financial/contracts-service";
import { isCivilDate } from "@/lib/financial/civil-date";
import { mapFinancialError } from "@/lib/financial/http";
import { denyFor } from "@/lib/authz/authz";
import { getTenantContext } from "@/lib/authz/tenant-context";
import { noWorkspaceResponse } from "@/lib/authz/http";

const ACTIONS = [
  "activate",
  "confirm",
  "suspend",
  "resume",
  "close",
  "cancel",
  "renew",
] as const;

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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
  const denied = await denyFor(user.id, "financial.contracts.lifecycle");
  if (denied) return denied;

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

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
    if (action === "activate" || action === "confirm") {
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
      if (action === "confirm" && (!isCivilDate(body.startDate ?? "") || (body.endDate && !isCivilDate(body.endDate)))) {
        return NextResponse.json(
          { data: null, error: { code: "VALIDATION_ERROR", message: "Confirmation dates must be valid" } },
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
      const contract = await withTenant(ctx.tenantId, () =>
        action === "confirm"
          ? confirmContract(params.id, {
              durationType: body.durationType,
              billingFrequency: body.billingFrequency ?? null,
              startDate: body.startDate,
              endDate: body.endDate ?? null,
              paymentMethod: body.paymentMethod ?? "pix",
              plan,
            }, user.id)
          : activateContract(params.id, plan, user.id)
      );
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

    const contract = await withTenant(ctx.tenantId, () =>
      applyLifecycleAction(
        params.id,
        action,
        {
          effectiveDate: body.effectiveDate ?? undefined,
          retainedInstallmentIds: body.retainedInstallmentIds ?? [],
        },
        user.id
      )
    );
    return NextResponse.json({ data: contract, error: null });
  } catch (error) {
    return mapFinancialError(error);
  }
}
