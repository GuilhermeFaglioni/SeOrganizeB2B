import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { denyFor } from "@/lib/authz/authz";
import { getTenantContext } from "@/lib/authz/tenant-context";
import { noWorkspaceResponse } from "@/lib/authz/http";
import { connectApiKey, listConnections } from "@/lib/ai/connections-service";
import { mapAiConnectionError } from "@/lib/ai/http";

function unauthorized() {
  return NextResponse.json(
    { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
    { status: 401 },
  );
}

export async function GET() {
  const user = await getUser();
  if (!user) return unauthorized();
  const denied = await denyFor(user.id, "ai.manageConnections");
  if (denied) return denied;

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

  try {
    const connections = await listConnections(ctx.tenantId);
    return NextResponse.json({ data: connections, error: null });
  } catch (error) {
    return mapAiConnectionError(error);
  }
}

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return unauthorized();
  const denied = await denyFor(user.id, "ai.manageConnections");
  if (denied) return denied;

  const ctx = await getTenantContext(user.id);
  if (!ctx.tenantId) return noWorkspaceResponse();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { data: null, error: { code: "VALIDATION_ERROR", message: "Invalid request body" } },
      { status: 400 },
    );
  }

  try {
    const connection = await connectApiKey(ctx.tenantId, user.id, {
      provider: body.provider,
      apiKey: body.apiKey,
      defaultModel: body.defaultModel,
    });
    return NextResponse.json({ data: connection, error: null }, { status: 201 });
  } catch (error) {
    return mapAiConnectionError(error);
  }
}
