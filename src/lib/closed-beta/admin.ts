import { getSuperAdminStatus } from "@/lib/admin/super-admin";
import { getUser } from "@/lib/supabase/server";

export type ClosedBetaAdminGate =
  | { ok: true; user: { id: string; email?: string } }
  | { ok: false; reason: "unauthorized" | "forbidden" };

export async function requireClosedBetaAdmin(): Promise<ClosedBetaAdminGate> {
  const user = await getUser();
  if (!user) return { ok: false, reason: "unauthorized" };
  if (!(await getSuperAdminStatus(user.id))) {
    return { ok: false, reason: "forbidden" };
  }
  return { ok: true, user };
}
