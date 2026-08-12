import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../prisma/client";
import { getUser } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";
import { isAppLocale } from "@/i18n/config";
import { createProfileWithWorkspace } from "@/lib/authz/workspace-setup";

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }

  const email = user.email || "Sistema";
  const name = user.user_metadata?.full_name || user.email || "Sistema";

  const existing = await prisma.profile.findUnique({ where: { id: user.id } });
  const profile = existing
    ? await prisma.profile.update({ where: { id: user.id }, data: { email } })
    : await createProfileWithWorkspace({ id: user.id, email, name });

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
