import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import {
  createProposalTemplate,
  listProposalTemplates,
} from "@/lib/financial/proposal-templates-service";
import { sanitizeProposalHtml } from "@/lib/financial/proposals";
import { mapFinancialError } from "@/lib/financial/http";

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const templates = await listProposalTemplates();
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

  try {
    const template = await createProposalTemplate(
      {
        name: body.name,
        html: sanitizeProposalHtml(body.html),
      },
      user.id
    );
    return NextResponse.json({ data: template, error: null }, { status: 201 });
  } catch (error) {
    return mapFinancialError(error);
  }
}
