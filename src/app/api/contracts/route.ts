import { NextRequest, NextResponse } from "next/server";
import { prisma, withTenant } from "../../../../prisma/client";
import { getUser } from "@/lib/supabase/server";
import { createContractDraft } from "@/lib/financial/contracts-service";
import { isCivilDate } from "@/lib/financial/civil-date";
import { mapFinancialError } from "@/lib/financial/http";
import { denyFor } from "@/lib/authz/authz";
import { applyScopeFilter } from "@/lib/authz/scope-filter";
import { getTenantContext } from "@/lib/authz/tenant-context";
import { noWorkspaceResponse } from "@/lib/authz/http";
import { applyFeatureGate, withFeatureWarning } from "@/lib/middleware/feature-gating";

const SORT_FIELDS = [
  "code",
  "title",
  "status",
  "officialValue",
  "startDate",
  "endDate",
  "createdAt",
] as const;

export async function GET(request: NextRequest) {
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
    pathname: "/api/contracts",
    method: "GET",
    tenantContext: ctx,
  });
  if (gate.response) return gate.response;

  const { searchParams } = request.nextUrl;
  const search = searchParams.get("search")?.trim() || "";
  const status = searchParams.get("status") || "";
  const clientId = searchParams.get("clientId") || "";
  const projectId = searchParams.get("projectId") || "";
  const sortByRaw = searchParams.get("sortBy") || "createdAt";
  const sortDir = searchParams.get("sortDir") === "asc" ? "asc" : "desc";
  const sortBy = (SORT_FIELDS as readonly string[]).includes(sortByRaw)
    ? (sortByRaw as (typeof SORT_FIELDS)[number])
    : "createdAt";
  const parsedPage = parseInt(searchParams.get("page") || "", 10);
  const page = Number.isNaN(parsedPage) ? 1 : Math.max(1, parsedPage);
  const parsedPageSize = parseInt(searchParams.get("pageSize") || "", 10);
  const pageSize = Number.isNaN(parsedPageSize)
    ? 25
    : Math.min(100, Math.max(1, parsedPageSize));

  const where = {
    ...(status ? { status } : {}),
    ...(clientId ? { clientId } : {}),
    ...(projectId ? { projects: { some: { projectId } } } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" as const } },
            { code: { contains: search, mode: "insensitive" as const } },
            {
              client: {
                name: { contains: search, mode: "insensitive" as const },
              },
            },
          ],
        }
      : {}),
  };

  return withTenant(ctx.tenantId, async () => {
    // Contracts have no area/project linkage, so area/project scope falls back
    // to tenant-level filtering (see scope-filter.ts).
    const scopedWhere = await applyScopeFilter(user.id, ctx.tenantId, "contract", where);
    const [items, total] = await Promise.all([
      prisma.contract.findMany({
        where: scopedWhere,
        include: {
          client: { select: { id: true, name: true } },
          _count: { select: { installments: true } },
        },
        orderBy: { [sortBy]: sortDir },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.contract.count({ where: scopedWhere }),
    ]);

    return NextResponse.json({
      data: {
        items,
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
      error: null,
    });
  });
}

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }
  const denied = await denyFor(user.id, "financial.contracts.create");
  if (denied) return denied;

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

  const gate = await applyFeatureGate({
    userId: user.id,
    pathname: "/api/contracts",
    method: "POST",
    tenantContext: ctx,
  });
  if (gate.response) return gate.response;

  const body = await request.json();

  if (!body.title || typeof body.title !== "string") {
    return NextResponse.json(
      {
        data: null,
        error: { code: "VALIDATION_ERROR", message: "Title is required" },
      },
      { status: 400 }
    );
  }
  if (!body.clientId) {
    return NextResponse.json(
      {
        data: null,
        error: { code: "VALIDATION_ERROR", message: "Client is required" },
      },
      { status: 400 }
    );
  }
  if (
    !body.durationType ||
    !["fixed", "openEnded", "oneTime"].includes(body.durationType)
  ) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: "VALIDATION_ERROR",
          message: "A valid duration type is required",
        },
      },
      { status: 400 }
    );
  }
  if (
    typeof body.officialValue !== "string" ||
    isNaN(Number(body.officialValue))
  ) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: "VALIDATION_ERROR",
          message: "Official value is required",
        },
      },
      { status: 400 }
    );
  }
  if (
    !body.startDate ||
    typeof body.startDate !== "string" ||
    !isCivilDate(body.startDate)
  ) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: "VALIDATION_ERROR",
          message: "A valid start date is required",
        },
      },
      { status: 400 }
    );
  }
  if (body.endDate && !isCivilDate(body.endDate)) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: "VALIDATION_ERROR",
          message: "End date must be a valid date",
        },
      },
      { status: 400 }
    );
  }

  try {
    const contract = await withTenant(ctx.tenantId, () =>
      createContractDraft(
        {
          title: body.title,
          clientId: body.clientId,
          ownerId: body.ownerId ?? null,
          durationType: body.durationType,
          officialValue: String(body.officialValue),
          startDate: body.startDate,
          endDate: body.endDate ?? null,
          billingFrequency: body.billingFrequency ?? null,
          paymentMethod: body.paymentMethod ?? "pix",
          documentUrl: body.documentUrl ?? null,
          notes: body.notes ?? null,
          items: body.items ?? [],
          projectIds: body.projectIds ?? [],
        },
        user.id
      )
    );
    return withFeatureWarning(
      NextResponse.json({ data: contract, error: null }, { status: 201 }),
      gate.warning
    );
  } catch (error) {
    return mapFinancialError(error);
  }
}
