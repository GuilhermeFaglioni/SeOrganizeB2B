import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { renderAIStudioSyntheticPreview } from "@/lib/ai/studio-service";
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

  const body = await readJsonBody(request);
  if (!body || typeof body.html !== "string" || !body.html.trim()) {
    return NextResponse.json(
      { data: null, error: { code: "VALIDATION_ERROR", message: "HTML do template é obrigatório." } },
      { status: 400 },
    );
  }

  try {
    const preview = renderAIStudioSyntheticPreview(
      body.html,
      body.locale === "en" ? "en" : "pt-BR",
    );
    return NextResponse.json({ data: preview, error: null });
  } catch (error) {
    return mapAIStudioError(error);
  }
}
