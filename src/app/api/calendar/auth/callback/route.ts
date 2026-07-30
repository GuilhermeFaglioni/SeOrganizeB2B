import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../../prisma/client";
import { getUser } from "@/lib/supabase/server";
import { exchangeCode } from "@/lib/google/oauth";

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/calendar?error=no_code", request.url));
  }

  const redirectUri = `${new URL(request.url).origin}/api/calendar/auth/callback`;

  try {
    const tokenData = await exchangeCode(code, redirectUri);

    let email = null;
    if (tokenData.id_token) {
      const payload = JSON.parse(
        Buffer.from(tokenData.id_token.split(".")[1], "base64").toString()
      );
      email = payload.email;
    }

    await prisma.calendarAuth.upsert({
      where: { userId: user.id },
      update: {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || (await prisma.calendarAuth.findUnique({ where: { userId: user.id } }))?.refreshToken,
        expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
        googleEmail: email,
      },
      create: {
        userId: user.id,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
        googleEmail: email,
      },
    });

    return NextResponse.redirect(
      new URL("/calendar?calendarAuth=connected", request.url),
    );
  } catch (error) {
    console.error("Google Calendar authorization failed:", error);
    return NextResponse.redirect(
      new URL("/calendar?calendarAuth=failed", request.url),
    );
  }
}
