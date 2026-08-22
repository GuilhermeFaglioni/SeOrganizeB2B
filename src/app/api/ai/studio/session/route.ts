import { getUser } from "@/lib/supabase/server";
import { discardAIStudioSession } from "@/lib/ai/studio-service";
import {
  mapAIStudioError,
  readJsonBody,
  requireAIStudioAccess,
  unauthorizedResponse,
} from "@/lib/ai/studio-http";

export async function DELETE(request: Request) {
  const user = await getUser();
  if (!user) return unauthorizedResponse();

  const access = await requireAIStudioAccess(user.id);
  if ("response" in access) return access.response;

  const body = await readJsonBody(request);
  try {
    discardAIStudioSession(access.tenantId, user.id, body?.sessionId);
    return Response.json({ data: null, error: null });
  } catch (error) {
    return mapAIStudioError(error);
  }
}
