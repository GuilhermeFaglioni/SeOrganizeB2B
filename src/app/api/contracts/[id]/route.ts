import { NextRequest, NextResponse } from "next/server";
import { prisma, withTenant } from "../../../../../prisma/client";
import { getUser } from "@/lib/supabase/server";
import {
  deleteContract,
  updateContract,
} from "@/lib/financial/contracts-service";
import { isCivilDate } from "@/lib/financial/civil-date";
import { mapFinancialError } from "@/lib/financial/http";
import { denyFor, canViewResource } from "@/lib/authz/authz";
import { getTenantContext } from "@/lib/authz/tenant-context";
import { noWorkspaceResponse } from "@/lib/authz/http";
import { applyFeatureGate, withFeatureWarning } from "@/lib/middleware/feature-gating";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }
  const denied = await denyFor(user.id, "financial.contracts.view");
  if (denied) return denied;

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

  const gate = await applyFeatureGate({
    userId: user.id,
    pathname: "/api/contracts/[id]",
    method: "GET",
    tenantContext: ctx,
  });
  if (gate.response) return gate.response;

  const contract = await withTenant(ctx.tenantId, () =>
    prisma.contract.findUnique({
      where: { id: params.id },
      include: {
        client: true,
        owner: { select: { id: true, name: true, email: true } },
        predecessor: {
          select: { id: true, code: true, title: true, status: true },
        },
        successors: {
          select: { id: true, code: true, title: true, status: true },
        },
        items: { orderBy: { position: "asc" } },
        projects: { include: { project: { select: { id: true, name: true } } } },
        installments: { orderBy: { dueDate: "asc" } },
        changes: {
          orderBy: { effectiveDate: "desc" },
          include: { actor: { select: { id: true, name: true, email: true } } },
        },
        audits: {
          orderBy: { createdAt: "desc" },
          include: { actor: { select: { id: true, name: true, email: true } } },
        },
      },
    })
  );

  if (!contract) {
    return NextResponse.json(
      {
        data: null,
        error: { code: "NOT_FOUND", message: "Contract not found" },
      },
      { status: 404 }
    );
  }

  // Contracts have no area/project linkage, so access is granted by the view
  // permission (tenant-level scope) already enforced via denyFor above.
  if (!(await canViewResource(user.id, "contract", params.id))) {
    return NextResponse.json(
      {
        data: null,
        error: { code: "NOT_FOUND", message: "Contract not found" },
      },
      { status: 404 }
    );
  }

  return NextResponse.json({ data: contract, error: null });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }
  const denied = await denyFor(user.id, "financial.contracts.edit");
  if (denied) return denied;

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

  const gate = await applyFeatureGate({
    userId: user.id,
    pathname: "/api/contracts/[id]",
    method: "PATCH",
    tenantContext: ctx,
  });
  if (gate.response) return gate.response;

  const body = await request.json();
  const input: Record<string, unknown> = {};
  for (const field of [
    "title",
    "clientId",
    "ownerId",
    "durationType",
    "officialValue",
    "startDate",
    "endDate",
    "billingFrequency",
    "paymentMethod",
    "documentUrl",
    "notes",
  ]) {
    if (body[field] !== undefined) input[field] = body[field];
  }
  if (input.officialValue !== undefined)
    input.officialValue = String(input.officialValue);
  if (input.startDate !== undefined && !isCivilDate(input.startDate as string)) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: "VALIDATION_ERROR",
          message: "Start date must be a valid date",
        },
      },
      { status: 400 }
    );
  }
  if (body.items !== undefined) input.items = body.items;
  if (body.projectIds !== undefined) input.projectIds = body.projectIds;

  try {
    const contract = await withTenant(ctx.tenantId, () =>
      updateContract(params.id, input, user.id)
    );
    return withFeatureWarning(
      NextResponse.json({ data: contract, error: null }),
      gate.warning
    );
  } catch (error) {
    return mapFinancialError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }
  const denied = await denyFor(user.id, "financial.contracts.delete");
  if (denied) return denied;

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

  const gate = await applyFeatureGate({
    userId: user.id,
    pathname: "/api/contracts/[id]",
    method: "DELETE",
    tenantContext: ctx,
  });
  if (gate.response) return gate.response;

  try {
    await withTenant(ctx.tenantId, () => deleteContract(params.id));
    return NextResponse.json({ data: null, error: null });
  } catch (error) {
    return mapFinancialError(error);
  }
}
