import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { prisma } from "../../../../../prisma/client";
import {
  renderProposalHtml,
  sanitizeProposalHtml,
} from "@/lib/financial/proposals";
import { isAppLocale } from "@/i18n/config";

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const body = await request.json();
  if (typeof body.html !== "string") {
    return NextResponse.json(
      {
        data: null,
        error: { code: "VALIDATION_ERROR", message: "Template HTML is required" },
      },
      { status: 400 }
    );
  }

  const workspace = await prisma.workspaceSettings.findUnique({
    where: { id: "default" },
  });

  const values: Record<string, string> =
    body.values && typeof body.values === "object"
      ? (body.values as Record<string, string>)
      : {};
  const items = Array.isArray(body.items) ? body.items : [];
  const locale = isAppLocale(body.locale) ? body.locale : "pt-BR";

  const html = renderProposalHtml(sanitizeProposalHtml(body.html), {
    values,
    items,
    companyName: workspace?.companyName ?? null,
    companyLogoUrl: workspace?.logoUrl ?? null,
    locale,
  });

  return NextResponse.json({ data: { html }, error: null });
}
