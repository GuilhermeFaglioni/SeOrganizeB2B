import { NextResponse } from "next/server";
import { prisma } from "../../../../prisma/client";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }

  try {
    const rows = await prisma.$queryRaw<Array<{
      db: string;
      user: string;
      roles_table_exists: boolean;
      has_is_admin: boolean;
      profiles_has_role_id: boolean;
      role_count: bigint;
      profile_count: bigint;
    }>>`
      SELECT
        current_database() AS db,
        current_user AS "user",
        to_regclass('public.roles') IS NOT NULL AS roles_table_exists,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'roles' AND column_name = 'is_admin'
        ) AS has_is_admin,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role_id'
        ) AS profiles_has_role_id,
        (SELECT count(*) FROM roles) AS role_count,
        (SELECT count(*) FROM profiles) AS profile_count
    `;
    const row = rows[0];
    return NextResponse.json({
      data: {
        db: row.db,
        user: row.user,
        roles_table_exists: row.roles_table_exists,
        has_is_admin: row.has_is_admin,
        profiles_has_role_id: row.profiles_has_role_id,
        role_count: Number(row.role_count),
        profile_count: Number(row.profile_count),
      },
      error: null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: "DB_CHECK_ERROR",
          message: error instanceof Error ? error.message : String(error),
        },
      },
      { status: 500 }
    );
  }
}
