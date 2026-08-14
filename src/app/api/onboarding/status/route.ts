import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getOnboardingStatus } from "@/lib/invites/service";

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 },
    );
  }

  const status = await getOnboardingStatus({
    userId: user.id,
    email: user.email ?? "",
  });
  return NextResponse.json({ data: status, error: null });
}
