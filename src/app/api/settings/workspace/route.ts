import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import {
  getWorkspaceSettings,
  updateWorkspaceSettings,
} from "@/lib/financial/workspace-settings-service";
import { mapFinancialError } from "@/lib/financial/http";

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const settings = await getWorkspaceSettings();
  return NextResponse.json({ data: settings, error: null });
}

export async function PATCH(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const body = await request.json();
  const input: { companyName?: string; logoUrl?: string } = {};
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

  try {
    const settings = await updateWorkspaceSettings(input);
    return NextResponse.json({ data: settings, error: null });
  } catch (error) {
    return mapFinancialError(error);
  }
}
