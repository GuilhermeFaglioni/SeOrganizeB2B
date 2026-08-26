import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { denyFor } from "@/lib/authz/authz";
import { getTenantContext } from "@/lib/authz/tenant-context";
import { noWorkspaceResponse } from "@/lib/authz/http";
import { AIMemberCreditLimitError, setMemberCreditLimit } from "@/lib/ai/member-credit-limits";

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  const denied = await denyFor(user.id, "manage_roles");
  if (denied) return denied;
  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();
  const body = await request.json().catch(() => null) as { monthlyLimit?: unknown } | null;
  const value = body?.monthlyLimit === null ? null : body?.monthlyLimit;
  if (value !== null && typeof value !== "number") return NextResponse.json({ data: null, error: { code: "VALIDATION_ERROR", message: "Monthly limit must be a non-negative integer" } }, { status: 400 });
  try {
    const result = await setMemberCreditLimit({ tenantId: ctx.tenantId, profileId: (await props.params).id, monthlyLimit: value as number | null });
    return NextResponse.json({ data: result, error: null });
  } catch (error) {
    if (error instanceof AIMemberCreditLimitError) return NextResponse.json({ data: null, error: { code: error.code, message: error.message } }, { status: error.message === "User not found" ? 404 : 400 });
    throw error;
  }
}
