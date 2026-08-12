import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "../../../../prisma/client";
import { createProfileWithWorkspace } from "@/lib/authz/workspace-setup";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.session) {
      return NextResponse.redirect(`${origin}/login`);
    }

    const { user } = data.session;
    const email = user.email ?? "";
    const name = user.user_metadata?.full_name ?? email;

    const existingProfile = await prisma.profile.findUnique({
      where: { id: user.id },
    });

    if (existingProfile) {
      await prisma.profile.update({
        where: { id: user.id },
        data: { email, name },
      });
    } else {
      await createProfileWithWorkspace({ id: user.id, email, name });
    }
  }

  return NextResponse.redirect(`${origin}/app`);
}
