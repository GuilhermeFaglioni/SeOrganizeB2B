import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getAIStudioConfig } from "@/lib/ai/studio-service";
import {
  mapAIStudioError,
  requireAIStudioAccess,
  unauthorizedResponse,
} from "@/lib/ai/studio-http";

export async function GET() {
  const user = await getUser();
  if (!user) return unauthorizedResponse();

  const access = await requireAIStudioAccess(user.id);
  if ("response" in access) return access.response;

  try {
    const config = await getAIStudioConfig(access.tenantId);
    return NextResponse.json({ data: config, error: null });
  } catch (error) {
    return mapAIStudioError(error);
  }
}
