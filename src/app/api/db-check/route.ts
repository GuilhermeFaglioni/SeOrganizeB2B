import { NextResponse } from "next/server";
import { prisma } from "../../../../prisma/client";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function redactHost(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.host;
  } catch {
    return url;
  }
}

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { code: "AUTH_ERROR", message: "Unauthorized" } },
      { status: 401 }
    );
  }

  try {
    // Raw path: Prisma routes $queryRaw through DIRECT_URL (when configured).
    const raw = await prisma.$queryRaw<Array<{
      db: string;
      user: string;
      has_is_admin: boolean;
    }>>`
      SELECT
        current_database() AS db,
        current_user AS "user",
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'roles' AND column_name = 'is_admin'
        ) AS has_is_admin
    `;

    // Typed path: Prisma routes findUnique/findFirst through DATABASE_URL.
    let typedOk = true;
    let typedError: string | null = null;
    try {
      await prisma.role.findFirst({ select: { id: true } });
    } catch (error) {
      typedOk = false;
      typedError = error instanceof Error ? error.message : String(error);
    }

    return NextResponse.json({
      data: {
        DATABASE_URL_host: redactHost(process.env.DATABASE_URL ?? ""),
        DIRECT_URL_host: redactHost(process.env.DIRECT_URL ?? ""),
        rawPath: raw[0],
        typedPath: { ok: typedOk, error: typedError },
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
