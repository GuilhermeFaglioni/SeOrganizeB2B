import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { denyFor } from "@/lib/authz/authz";
import { getTenantContext } from "@/lib/authz/tenant-context";
import { noWorkspaceResponse } from "@/lib/authz/http";
import {
  clearWorkspaceDirective,
  getWorkspaceDirective,
  upsertWorkspaceDirective,
  validateDirectiveContent,
} from "@/lib/ai/directives-service";
import { mapFinancialError } from "@/lib/financial/http";

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }
  const denied = await denyFor(user.id, "ai.manageDirectives");
  if (denied) return denied;

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

  const directive = await getWorkspaceDirective(ctx.tenantId);
  return NextResponse.json({ data: directive, error: null });
}

export async function PUT(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }
  const denied = await denyFor(user.id, "ai.manageDirectives");
  if (denied) return denied;

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

  const body = await request.json();
  let content: string;
  try {
    content = validateDirectiveContent(body.content);
  } catch (error) {
    return mapFinancialError(error);
  }

  try {
    const directive = await upsertWorkspaceDirective(
      { content },
      ctx.tenantId,
      user.id
    );
    return NextResponse.json({ data: directive, error: null });
  } catch (error) {
    return mapFinancialError(error);
  }
}

export async function DELETE() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }
  const denied = await denyFor(user.id, "ai.manageDirectives");
  if (denied) return denied;

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

  try {
    await clearWorkspaceDirective(ctx.tenantId);
    return NextResponse.json({ data: null, error: null });
  } catch (error) {
    return mapFinancialError(error);
  }
}
