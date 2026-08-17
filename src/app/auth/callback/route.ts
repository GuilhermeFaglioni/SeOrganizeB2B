import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSiteOrigin } from "@/lib/site-url";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const origin = getSiteOrigin(new URL(request.url).origin);
  const code = searchParams.get("code");
  const closedBetaToken = searchParams.get("closedBetaToken");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.session) {
      return NextResponse.redirect(`${origin}/login`);
    }

  }

  if (closedBetaToken) {
    return NextResponse.redirect(
      `${origin}/closed-beta/accept?token=${encodeURIComponent(closedBetaToken)}`,
    );
  }

  return NextResponse.redirect(`${origin}/app`);
}
