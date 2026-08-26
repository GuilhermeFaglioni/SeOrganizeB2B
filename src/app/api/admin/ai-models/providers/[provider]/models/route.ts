import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getSuperAdminStatus } from "@/lib/admin/super-admin";
import { getAIProvider, isAIProviderId } from "@/lib/ai/providers";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  props: { params: Promise<{ provider: string }> },
) {
  const user = await getUser();
  if (!user)
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR" } },
      { status: 401 },
    );
  if (!(await getSuperAdminStatus(user.id)))
    return NextResponse.json(
      { data: null, error: { code: "FORBIDDEN" } },
      { status: 403 },
    );

  const { provider: providerId } = await props.params;
  if (!isAIProviderId(providerId))
    return NextResponse.json(
      {
        data: null,
        error: { code: "VALIDATION_ERROR", message: "Unknown provider" },
      },
      { status: 400 },
    );
  const provider = getAIProvider(providerId);
  if (!provider)
    return NextResponse.json(
      {
        data: null,
        error: { code: "NOT_FOUND", message: "Provider unavailable" },
      },
      { status: 404 },
    );
  if (!provider.listAvailableModels)
    return NextResponse.json({ data: provider.models, error: null });

  const secret =
    process.env[
      `AI_STUDIO_MANAGED_${providerId.toUpperCase().replaceAll("-", "_")}_API_KEY`
    ];
  if (!secret)
    return NextResponse.json(
      {
        data: null,
        error: {
          code: "CONFIGURATION_ERROR",
          message: "Managed provider credentials are not configured",
        },
      },
      { status: 503 },
    );

  try {
    return NextResponse.json({
      data: await provider.listAvailableModels(secret),
      error: null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: "PROVIDER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Could not load provider models",
          ...(typeof error === "object" && error !== null && "code" in error
            ? { providerErrorCode: error.code }
            : {}),
        },
      },
      { status: 502 },
    );
  }
}
