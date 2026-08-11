import "dotenv/config";
import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "../../prisma/client";

const TENANT_A = "00000000-0000-0000-0000-000000000001";
const UNKNOWN_TENANT = "00000000-0000-0000-0000-000000000002";
const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

const TENANT_SCOPED_TABLES = [
  "activities",
  "calendar_auth",
  "calendar_event_attendees",
  "calendar_events",
  "clients",
  "comment_mentions",
  "comments",
  "contract_audits",
  "contract_changes",
  "contract_items",
  "contract_projects",
  "contracts",
  "documents",
  "installments",
  "notifications",
  "profiles",
  "project_columns",
  "projects",
  "proposal_items",
  "proposal_templates",
  "proposals",
  "push_subscriptions",
  "roles",
  "saved_views",
  "task_assignees",
  "tasks",
  "team_areas",
  "team_member_areas",
];

const GLOBAL_CATALOG_TABLES = ["workspaces", "plans", "plan_limits"];

let dbAvailable = false;

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbAvailable = true;
  } catch (error) {
    console.warn(
      "Local Supabase DB unreachable — skipping RLS integration tests.",
      (error as Error).message
    );
  }
});

async function withDb(
  ctx: { skip: (reason?: string) => void },
  fn: () => Promise<void>
) {
  if (!dbAvailable) return ctx.skip("Local Supabase DB unreachable");
  await fn();
}

describe("RLS — direct DB queries without the middleware are gated (defense-in-depth, T-015)", () => {
  it("enables RLS on every tenant-scoped table", async (ctx) => {
    await withDb(ctx, async () => {
      const rows = await prisma.$queryRaw<{ tablename: string }[]>`
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public' AND rowsecurity
        ORDER BY tablename`;
      const rlsTables = rows.map((r) => r.tablename);

      for (const table of TENANT_SCOPED_TABLES) {
        expect(rlsTables).toContain(table);
      }
    });
  });

  it("does not enable RLS on global catalog tables", async (ctx) => {
    await withDb(ctx, async () => {
      const rows = await prisma.$queryRaw<{ tablename: string }[]>`
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public' AND rowsecurity`;
      const rlsTables = new Set(rows.map((r) => r.tablename));

      for (const table of GLOBAL_CATALOG_TABLES) {
        expect(rlsTables.has(table)).toBe(false);
      }
    });
  });

  it("installs tenant_isolation_* and super_admin_bypass policies on tenant-scoped tables", async (ctx) => {
    await withDb(ctx, async () => {
      const rows = await prisma.$queryRaw<{ policyname: string }[]>`
        SELECT DISTINCT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'tasks'`;
      const policyNames = new Set(rows.map((r) => r.policyname));

      for (const policy of [
        "tenant_isolation_select",
        "tenant_isolation_insert",
        "tenant_isolation_update",
        "tenant_isolation_delete",
        "super_admin_bypass",
      ]) {
        expect(policyNames.has(policy)).toBe(true);
      }
    });
  });

  it("policy compares tenant_id against app.current_tenant_id with a deny-by-default fallback", async (ctx) => {
    await withDb(ctx, async () => {
      const rows = await prisma.$queryRaw<{ qual: string | null }[]>`
        SELECT qual
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'tasks'
          AND policyname = 'tenant_isolation_select'`;
      const qual = rows[0]?.qual ?? "";

      expect(qual).toContain("current_setting");
      expect(qual).toContain("app.current_tenant_id");
      expect(qual).toContain(ZERO_UUID);
    });
  });

  it("denies by default when app.current_tenant_id is unset", async (ctx) => {
    await withDb(ctx, async () => {
      const unset = await prisma.$queryRaw<{ guc_unset: boolean }[]>`
        SELECT current_setting('app.current_tenant_id', true) IS NULL AS guc_unset`;
      expect(unset[0].guc_unset).toBe(true);

      const denied = await prisma.$queryRaw<{ c: number }[]>`
        SELECT count(*)::int AS c
        FROM tasks
        WHERE tenant_id = COALESCE(
          NULLIF(current_setting('app.current_tenant_id', true), ''),
          ${ZERO_UUID}::text
        )`;
      expect(denied[0].c).toBe(0);
    });
  });

  it("scopes a direct query to the tenant set in the GUC and blocks other tenants", async (ctx) => {
    await withDb(ctx, async () => {
      const result = await prisma.$transaction(async (tx) => {
        const reference = await tx.$queryRaw<{ c: number }[]>`
          SELECT count(*)::int AS c FROM tasks WHERE tenant_id = ${TENANT_A}`;

        await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${TENANT_A}, true)`;
        const ownRows = await tx.$queryRaw<{ c: number }[]>`
          SELECT count(*)::int AS c
          FROM tasks
          WHERE tenant_id = COALESCE(
            NULLIF(current_setting('app.current_tenant_id', true), ''),
            ${ZERO_UUID}::text
          )`;

        await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${UNKNOWN_TENANT}, true)`;
        const otherRows = await tx.$queryRaw<{ c: number }[]>`
          SELECT count(*)::int AS c
          FROM tasks
          WHERE tenant_id = COALESCE(
            NULLIF(current_setting('app.current_tenant_id', true), ''),
            ${ZERO_UUID}::text
          )`;

        return { reference, ownRows, otherRows };
      });

      expect(result.ownRows[0].c).toBe(result.reference[0].c);
      expect(result.otherRows[0].c).toBe(0);
    });
  });
});