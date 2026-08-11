import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { withTenant } from "../../../../../prisma/client";
import {
  cancelInstallment,
  recordPayment,
} from "@/lib/financial/installments-service";
import { isCivilDate } from "@/lib/financial/civil-date";
import { mapFinancialError } from "@/lib/financial/http";
import { denyFor } from "@/lib/authz/authz";
import { getTenantContext } from "@/lib/authz/tenant-context";
import { noWorkspaceResponse } from "@/lib/authz/http";

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
  const denied = await denyFor(user.id, "financial.receivables.markPaid");
  if (denied) return denied;

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

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
      const installment = await withTenant(ctx.tenantId, () =>
        recordPayment(params.id, paidAt, user.id)
      );
      return NextResponse.json({ data: installment, error: null });
    }
    if (body.action === "cancel") {
      const installment = await withTenant(ctx.tenantId, () =>
        cancelInstallment(params.id, user.id)
      );
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
    return mapFinancialError(error);
  }
}
