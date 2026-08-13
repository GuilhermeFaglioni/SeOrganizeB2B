import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/authz/tenant-context";
import {
  getWorkspaceSettings,
  updateWorkspaceSettings,
} from "@/lib/financial/workspace-settings-service";
import { mapFinancialError } from "@/lib/financial/http";

function unauthorized() {
  return NextResponse.json(
    { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
    { status: 401 }
  );
}

function notFound() {
  return NextResponse.json(
    { data: null, error: { code: "NOT_FOUND", message: "Workspace not found" } },
    { status: 404 }
  );
}

function forbidden() {
  return NextResponse.json(
    {
      data: null,
      error: {
        code: "FORBIDDEN",
        message: "You do not have permission to perform this action",
      },
    },
    { status: 403 }
  );
}

export async function GET() {
  const user = await getUser();
  if (!user) return unauthorized();

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return notFound();

  const settings = await getWorkspaceSettings(ctx.tenantId);
  return NextResponse.json({ data: settings, error: null });
}

export async function PATCH(request: NextRequest) {
  const user = await getUser();
  if (!user) return unauthorized();

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return notFound();
  if (!ctx.isAdmin) return forbidden();

  const body = await request.json();
  const input: { companyName?: string; logoUrl?: string; pixKey?: string } = {};
  if (body.companyName !== undefined) {
    if (typeof body.companyName !== "string") {
      return NextResponse.json(
        {
          data: null,
          error: { code: "VALIDATION_ERROR", message: "Company name must be a string" },
        },
        { status: 400 }
      );
    }
    input.companyName = body.companyName;
  }
  if (body.logoUrl !== undefined) {
    if (typeof body.logoUrl !== "string") {
      return NextResponse.json(
        {
          data: null,
          error: { code: "VALIDATION_ERROR", message: "Logo URL must be a string" },
        },
        { status: 400 }
      );
    }
    input.logoUrl = body.logoUrl;
  }
  if (body.pixKey !== undefined) {
    if (typeof body.pixKey !== "string") {
      return NextResponse.json(
        {
          data: null,
          error: { code: "VALIDATION_ERROR", message: "PIX key must be a string" },
        },
        { status: 400 }
      );
    }
    input.pixKey = body.pixKey;
  }

  try {
    const settings = await updateWorkspaceSettings(input, ctx.tenantId);
    return NextResponse.json({ data: settings, error: null });
  } catch (error) {
    return mapFinancialError(error);
  }
}
