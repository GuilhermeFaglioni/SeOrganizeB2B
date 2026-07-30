import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "../../../../prisma/client";

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
    await prisma.profile.upsert({
      where: { id: user.id },
      update: { email: user.email!, name: user.user_metadata?.full_name ?? user.email },
      create: {
        id: user.id,
        email: user.email!,
        name: user.user_metadata?.full_name ?? user.email,
      },
    });
  }

  return NextResponse.redirect(`${origin}/`);
}
