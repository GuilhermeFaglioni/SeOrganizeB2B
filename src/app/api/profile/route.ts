import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../prisma/client";
import { getUser } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";
import { isAppLocale } from "@/i18n/config";
import { createProfileWithWorkspace } from "@/lib/authz/workspace-setup";
import {
  getOnboardingStatus,
} from "@/lib/invites/service";
import { isPublicWorkspaceProvisioningBlocked } from "@/lib/closed-beta/service";

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }

  const email = user.email?.trim().toLowerCase() || "sistema";
  const name = user.user_metadata?.full_name || user.email || "Sistema";

  const existing = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { id: true, removedAt: true },
  });
  let profile;
  if (existing) {
    if (existing.removedAt) {
      return NextResponse.json(
        { data: null, error: { code: "MEMBER_REMOVED", message: "This account no longer has access" } },
        { status: 403 },
      );
    }
    profile = await prisma.profile.update({ where: { id: user.id }, data: { email } });
  } else {
    const onboarding = await getOnboardingStatus({
      userId: user.id,
      email,
    });
    if (onboarding.status !== "workspace_creation_required") {
      return NextResponse.json(
        {
          data: onboarding,
          error: {
            code: "ONBOARDING_REQUIRED",
            message: "Workspace onboarding requires another step",
          },
        },
        { status: 409 },
      );
    }
    if (await isPublicWorkspaceProvisioningBlocked()) {
      return NextResponse.json(
        {
          data: null,
          error: {
            code: "CLOSED_BETA_ONLY",
            message: "This beta is available by invitation only",
          },
        },
        { status: 409 },
      );
    }
    try {
      profile = await createProfileWithWorkspace({ id: user.id, email, name });
    } catch (error) {
      // I18nProvider and AuthGate can initialize a freshly authenticated user
      // concurrently. If the other request won the profile unique constraint,
      // reuse its profile instead of surfacing a transient 500.
      if (!isUniqueViolation(error)) throw error;
      profile = await prisma.profile.findUnique({ where: { id: user.id } });
      if (!profile) throw error;
    }
  }

  return NextResponse.json({ data: profile, error: null });
}

export async function PATCH(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }

  const body = await request.json();
  const { name, locale } = body;

  if (locale !== undefined && !isAppLocale(locale)) {
    return NextResponse.json({ data: null, error: { code: "VALIDATION_ERROR", message: "Invalid locale" } }, { status: 400 });
  }

  const data: { name?: string; locale?: string } = {};
  if (typeof name === "string" && name.trim()) {
    data.name = name.trim();
  }
  if (locale !== undefined) {
    data.locale = locale;
  }
  if (!data.name && data.locale === undefined) {
    return NextResponse.json({ data: null, error: { code: "VALIDATION_ERROR", message: "Nothing to update" } }, { status: 400 });
  }

  if (data.name) {
    const supabase = await createClient();
    const { error: authError } = await supabase.auth.updateUser({
      data: { full_name: data.name },
    });
    if (authError) {
      return NextResponse.json(
        {
          data: null,
          error: {
            code: "AUTH_UPDATE_ERROR",
            message: authError.message,
          },
        },
        { status: 502 },
      );
    }
  }

  const updated = await prisma.profile.update({
    where: { id: user.id },
    data,
  });

  return NextResponse.json({ data: { id: updated.id, name: updated.name, email: updated.email, locale: updated.locale }, error: null });
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}
