import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { denyFor } from "@/lib/authz/authz";
import { listTeam } from "@/lib/authz/roles-service";

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } }, { status: 401 });
  }
  const denied = await denyFor(user.id, "manage_roles");
  if (denied) return denied;

  const team = await listTeam();
  return NextResponse.json({ data: team, error: null });
}
