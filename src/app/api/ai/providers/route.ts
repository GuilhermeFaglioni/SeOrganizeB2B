import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { listAIProviders } from "@/lib/ai/providers";

/**
 * Read-only catalog of enabled AI providers and their controlled models. This
 * is static, non-sensitive metadata (no secrets, no tenant data) consumed by
 * the connection UI and the AI Studio to render model choices and to expose
 * streaming/vision capabilities. It is not a generation endpoint.
 */
export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 },
    );
  }

  const providers = listAIProviders().map((provider) => ({
    id: provider.id,
    name: provider.name,
    authMethods: provider.authMethods,
    oauth: provider.oauth,
    defaultModel: provider.defaultModel,
    models: provider.models.map((model) => ({
      id: model.id,
      vision: model.vision,
      streaming: model.streaming,
      default: model.default,
    })),
  }));

  return NextResponse.json({ data: providers, error: null });
}
