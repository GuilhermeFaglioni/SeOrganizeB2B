import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getEffectivePermissions } from "@/lib/authz/authz";

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }

  const effective = await getEffectivePermissions(user.id);
  return NextResponse.json({ data: effective, error: null });
}
