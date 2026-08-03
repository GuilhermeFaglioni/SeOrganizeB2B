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
    // Raw path uses the same runtime PrismaClient as typed queries.
    const raw = await prisma.$queryRaw<Array<{
      db: string;
      user: string;
      server_addr: string | null;
      server_port: number;
      current_schema: string;
      search_path: string;
      schemas: string[];
      unqualified_roles: string | null;
      public_roles: string | null;
      has_is_admin: boolean;
    }>>`
      SELECT
        current_database() AS db,
        current_user AS "user",
        inet_server_addr()::text AS server_addr,
        inet_server_port() AS server_port,
        current_schema() AS current_schema,
        current_setting('search_path') AS search_path,
        current_schemas(false) AS schemas,
        to_regclass('roles')::text AS unqualified_roles,
        to_regclass('public.roles')::text AS public_roles,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'roles' AND column_name = 'is_admin'
        ) AS has_is_admin
    `;

    let rawColumnOk = true;
    let rawColumnError: string | null = null;
    try {
      await prisma.$queryRaw<Array<{ is_admin: boolean }>>`
        SELECT is_admin FROM public.roles LIMIT 1
      `;
    } catch (error) {
      rawColumnOk = false;
      rawColumnError = error instanceof Error ? error.message : String(error);
    }

    // Typed path: run the exact relation query used by authorization.
    let typedOk = true;
    let typedError: string | null = null;
    try {
      await prisma.profile.findFirst({
        where: { id: user.id },
        select: {
          id: true,
          role: {
            select: { id: true, name: true, isAdmin: true, permissions: true },
          },
        },
      });
    } catch (error) {
      typedOk = false;
      typedError = error instanceof Error ? error.message : String(error);
    }

    return NextResponse.json({
      data: {
        DATABASE_URL_host: redactHost(process.env.DATABASE_URL ?? ""),
        DIRECT_URL_host: redactHost(process.env.DIRECT_URL ?? ""),
        runtimeClient: "DATABASE_URL (prisma/client.ts datasource override)",
        rawPath: raw[0],
        rawColumnPath: { ok: rawColumnOk, error: rawColumnError },
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
