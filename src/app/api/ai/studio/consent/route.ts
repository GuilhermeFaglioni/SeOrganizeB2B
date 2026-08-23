import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { recordAIStudioConsent } from "@/lib/ai/studio-service";
import {
  mapAIStudioError,
  readJsonBody,
  requireAIStudioAccess,
  unauthorizedResponse,
} from "@/lib/ai/studio-http";

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return unauthorizedResponse();

  const access = await requireAIStudioAccess(user.id);
  if ("response" in access) return access.response;

  let body: Awaited<ReturnType<typeof readJsonBody>>;
  try {
    body = await readJsonBody(request);
  } catch (error) {
    return mapAIStudioError(error);
  }
  if (!body || body.accepted !== true) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: "CONSENT_REQUIRED",
          message: "O consentimento explícito é necessário antes de usar o provider.",
        },
      },
      { status: 428 },
    );
  }

  try {
    const consent = await recordAIStudioConsent({
      tenantId: access.tenantId,
      actorId: user.id,
      provider: body.provider,
      version: body.version,
    });
    return NextResponse.json({ data: consent, error: null }, { status: 201 });
  } catch (error) {
    return mapAIStudioError(error);
  }
}
