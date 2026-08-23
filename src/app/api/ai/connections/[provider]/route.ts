import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { denyFor } from "@/lib/authz/authz";
import { getTenantContext } from "@/lib/authz/tenant-context";
import { noWorkspaceResponse } from "@/lib/authz/http";
import { isAIProviderId } from "@/lib/ai/providers";
import { revokeConnection } from "@/lib/ai/connections-service";
import { mapAiConnectionError } from "@/lib/ai/http";

function unauthorized() {
  return NextResponse.json(
    { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
    { status: 401 },
  );
}

function invalidProvider() {
  return NextResponse.json(
    { data: null, error: { code: "VALIDATION_ERROR", message: "Unknown provider" } },
    { status: 400 },
  );
}

export async function DELETE(
  _request: NextRequest,
  props: { params: Promise<{ provider: string }> },
) {
  const params = await props.params;
  const user = await getUser();
  if (!user) return unauthorized();
  const denied = await denyFor(user.id, "ai.manageConnections");
  if (denied) return denied;

  if (!isAIProviderId(params.provider)) return invalidProvider();

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

  try {
    const connection = await revokeConnection(ctx.tenantId, params.provider, user.id);
    return NextResponse.json({ data: connection, error: null });
  } catch (error) {
    return mapAiConnectionError(error);
  }
}
