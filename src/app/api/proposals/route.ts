import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { withTenant } from "../../../../prisma/client";
import {
  createProposalDraft,
  listProposals,
} from "@/lib/financial/proposals-service";
import { isCivilDate } from "@/lib/financial/civil-date";
import { mapFinancialError } from "@/lib/financial/http";
import { denyFor } from "@/lib/authz/authz";
import { getTenantContext } from "@/lib/authz/tenant-context";
import { noWorkspaceResponse } from "@/lib/authz/http";
import { applyFeatureGate, withFeatureWarning } from "@/lib/middleware/feature-gating";

const SORT_FIELDS = ["code", "title", "status", "totalValue", "createdAt", "client"] as const;

function parseProposalInput(body: Record<string, unknown>) {
  const errors: string[] = [];

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) errors.push("A title is required");

  const clientId = typeof body.clientId === "string" ? body.clientId : "";
  if (!clientId) errors.push("A client is required");

  const templateId =
    typeof body.templateId === "string" && body.templateId ? body.templateId : null;

  let totalValue: string | null = null;
  if (body.totalValue !== undefined && body.totalValue !== null && body.totalValue !== "") {
    const raw = String(body.totalValue);
    if (isNaN(Number(raw))) {
      errors.push("Total value must be a valid number");
    } else {
      totalValue = raw;
    }
  }

  const issueDate = typeof body.issueDate === "string" && body.issueDate ? body.issueDate : null;
  if (issueDate && !isCivilDate(issueDate)) errors.push("Issue date must be a valid date");

  const validUntil = typeof body.validUntil === "string" && body.validUntil ? body.validUntil : null;
  if (validUntil && !isCivilDate(validUntil)) errors.push("Validity date must be a valid date");

  let variables: Record<string, string> = {};
  if (body.variables !== undefined) {
    if (typeof body.variables !== "object" || body.variables === null || Array.isArray(body.variables)) {
      errors.push("Variables must be an object");
    } else {
      variables = body.variables as Record<string, string>;
    }
  }

  const items = Array.isArray(body.items) ? body.items : [];
  (items as Record<string, unknown>[]).forEach((row, index) => {
    if (typeof row.name !== "string" || !row.name.trim()) {
      errors.push(`Item ${index + 1} needs a name`);
    }
    if (
      row.quantity !== undefined &&
      row.quantity !== null &&
      row.quantity !== "" &&
      isNaN(Number(row.quantity))
    ) {
      errors.push(`Item ${index + 1} has an invalid quantity`);
    }
    if (
      row.price !== undefined &&
      row.price !== null &&
      row.price !== "" &&
      isNaN(Number(row.price))
    ) {
      errors.push(`Item ${index + 1} has an invalid price`);
    }
  });

  return {
    errors,
    input: {
      title,
      clientId,
      templateId,
      totalValue,
      issueDate,
      validUntil,
      variables,
      items,
    },
  };
}

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }
  const denied = await denyFor(user.id, "financial.proposals.view");
  if (denied) return denied;

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

  const gate = await applyFeatureGate({
    userId: user.id,
    pathname: "/api/proposals",
    method: "GET",
    tenantContext: ctx,
  });
  if (gate.response) return gate.response;

  const { searchParams } = request.nextUrl;
  const sortByRaw = searchParams.get("sortBy") || "createdAt";
  const sortBy = (SORT_FIELDS as readonly string[]).includes(sortByRaw)
    ? sortByRaw
    : "createdAt";

  const result = await withTenant(ctx.tenantId, () =>
    listProposals({
      search: searchParams.get("search")?.trim() || undefined,
      status: searchParams.get("status") || undefined,
      page: Number(searchParams.get("page") || "1") || 1,
      pageSize: Number(searchParams.get("pageSize") || "25") || 25,
      sortBy,
      sortDir: searchParams.get("sortDir") === "asc" ? "asc" : "desc",
    })
  );

  return NextResponse.json({ data: result, error: null });
}

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }
  const denied = await denyFor(user.id, "financial.proposals.create");
  if (denied) return denied;

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

  const gate = await applyFeatureGate({
    userId: user.id,
    pathname: "/api/proposals",
    method: "POST",
    tenantContext: ctx,
  });
  if (gate.response) return gate.response;

  const body = await request.json();
  const { errors, input } = parseProposalInput(body);
  if (errors.length > 0) {
    return NextResponse.json(
      {
        data: null,
        error: { code: "VALIDATION_ERROR", message: errors.join("; ") },
      },
      { status: 400 }
    );
  }

  try {
    const proposal = await withTenant(ctx.tenantId, () =>
      createProposalDraft(input, user.id)
    );
    return withFeatureWarning(
      NextResponse.json({ data: proposal, error: null }, { status: 201 }),
      gate.warning
    );
  } catch (error) {
    return mapFinancialError(error);
  }
}
