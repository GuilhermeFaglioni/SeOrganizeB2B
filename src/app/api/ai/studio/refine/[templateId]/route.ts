import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import {
  getAIStudioRefinementBase,
  updateRefinedTemplate,
} from "@/lib/ai/studio-service";
import {
  mapAIStudioError,
  readJsonBody,
  requireAIStudioAccess,
  unauthorizedResponse,
} from "@/lib/ai/studio-http";

export async function GET(
  _request: Request,
  props: { params: Promise<{ templateId: string }> },
) {
  const params = await props.params;
  const user = await getUser();
  if (!user) return unauthorizedResponse();

  const access = await requireAIStudioAccess(user.id);
  if ("response" in access) return access.response;

  try {
    const base = await getAIStudioRefinementBase(access.tenantId, params.templateId);
    return NextResponse.json({ data: base, error: null });
  } catch (error) {
    return mapAIStudioError(error);
  }
}

export async function POST(
  request: Request,
  props: { params: Promise<{ templateId: string }> },
) {
  const params = await props.params;
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
  if (!body) {
    return NextResponse.json(
      { data: null, error: { code: "VALIDATION_ERROR", message: "Corpo da requisição inválido." } },
      { status: 400 },
    );
  }

  try {
    const result = await updateRefinedTemplate({
      tenantId: access.tenantId,
      actorId: user.id,
      templateId: params.templateId,
      html: body.html,
      confirmed: body.confirmed,
      cycleId: body.cycleId,
    });
    return NextResponse.json({ data: result, error: null });
  } catch (error) {
    return mapAIStudioError(error);
  }
}
