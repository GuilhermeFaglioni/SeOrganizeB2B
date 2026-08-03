import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import {
  deleteProposalTemplate,
  getProposalTemplate,
  updateProposalTemplate,
} from "@/lib/financial/proposal-templates-service";
import { sanitizeProposalHtml } from "@/lib/financial/proposals";
import { mapFinancialError } from "@/lib/financial/http";
import { denyFor } from "@/lib/authz/authz";

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
  const denied = await denyFor(user.id, "financial.proposals.view");
  if (denied) return denied;

  const template = await getProposalTemplate(params.id);
  if (!template) {
    return NextResponse.json(
      {
        data: null,
        error: { code: "NOT_FOUND", message: "Template not found" },
      },
      { status: 404 }
    );
  }
  return NextResponse.json({ data: template, error: null });
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
  const denied = await denyFor(user.id, "financial.proposals.manageTemplates");
  if (denied) return denied;

  const body = await request.json();
  const input: { name?: string; html?: string } = {};
  if (body.name !== undefined) input.name = String(body.name);
  if (body.html !== undefined) input.html = sanitizeProposalHtml(String(body.html));

  try {
    const template = await updateProposalTemplate(params.id, input);
    return NextResponse.json({ data: template, error: null });
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
  const denied = await denyFor(user.id, "financial.proposals.manageTemplates");
  if (denied) return denied;

  try {
    await deleteProposalTemplate(params.id);
    return NextResponse.json({ data: null, error: null });
  } catch (error) {
    return mapFinancialError(error);
  }
}
