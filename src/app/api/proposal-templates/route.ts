import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { withTenant } from "../../../../prisma/client";
import {
  createProposalTemplate,
  listProposalTemplates,
} from "@/lib/financial/proposal-templates-service";
import { sanitizeProposalHtml } from "@/lib/financial/proposals";
import { sanitizeAIStudioHtml } from "@/lib/ai/studio-service";
import { mapAIStudioError } from "@/lib/ai/studio-http";
import { mapFinancialError } from "@/lib/financial/http";
import { denyFor } from "@/lib/authz/authz";
import { getTenantContext } from "@/lib/authz/tenant-context";
import { noWorkspaceResponse } from "@/lib/authz/http";

export async function GET() {
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

  const templates = await withTenant(ctx.tenantId, () =>
    listProposalTemplates()
  );
  return NextResponse.json({ data: templates, error: null });
}

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }
  const denied = await denyFor(user.id, "financial.proposals.manageTemplates");
  if (denied) return denied;

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

  const body = await request.json();
  if (typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json(
      {
        data: null,
        error: { code: "VALIDATION_ERROR", message: "A template name is required" },
      },
      { status: 400 }
    );
  }
  if (typeof body.html !== "string") {
    return NextResponse.json(
      {
        data: null,
        error: { code: "VALIDATION_ERROR", message: "Template HTML is required" },
      },
      { status: 400 }
    );
  }

  let sanitizedHtml: string;
  try {
    sanitizedHtml = body.source === "ai-studio"
      ? sanitizeAIStudioHtml(body.html).html
      : sanitizeProposalHtml(body.html);
  } catch (error) {
    if (body.source === "ai-studio") return mapAIStudioError(error);
    return mapFinancialError(error);
  }

  try {
    const template = await withTenant(ctx.tenantId, () =>
      createProposalTemplate(
        {
          name: body.name,
          html: sanitizedHtml,
          cycleId: typeof body.cycleId === "string" ? body.cycleId : null,
        },
        user.id
      )
    );
    return NextResponse.json({ data: template, error: null }, { status: 201 });
  } catch (error) {
    return mapFinancialError(error);
  }
}
