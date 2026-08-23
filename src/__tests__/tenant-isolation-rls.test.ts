import "dotenv/config";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
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
  "ai_provider_connections",
  "ai_provider_connection_audits",
  "workspace_directives",
  "ai_studio_usage_events",
  "ai_studio_consents",
];

const AI_STUDIO_TABLES = [
  "ai_provider_connections",
  "ai_provider_connection_audits",
  "workspace_directives",
  "ai_studio_usage_events",
  "ai_studio_consents",
] as const;

type AIStudioTable = (typeof AI_STUDIO_TABLES)[number];

type RlsFixture = {
  tenantA: string;
  tenantB: string;
  tenantProbe: string;
  actorA: string;
  actorB: string;
  actorProbe: string;
  connectionA: string;
  connectionB: string;
};

const GLOBAL_CATALOG_TABLES = ["workspaces", "plans", "plan_limits"];

let dbAvailable = false;

function isDatabaseUnavailable(error: unknown): boolean {
  const candidate = error as { code?: string; message?: string };
  return (
    ["P1001", "P1002", "P1017"].includes(candidate.code ?? "") ||
    /DATABASE_URL is not set|Can't reach database server|ECONNREFUSED|ENOTFOUND/.test(
      candidate.message ?? "",
    )
  );
}

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbAvailable = true;
  } catch (error) {
    if (!isDatabaseUnavailable(error)) throw error;
    console.warn(
      "Local Supabase DB unreachable — skipping RLS integration tests.",
      (error as Error).message,
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

async function countRows(transaction: Prisma.TransactionClient, table: AIStudioTable): Promise<number> {
  const rows = await transaction.$queryRawUnsafe<Array<{ count: number }>>(
    `SELECT count(*)::int AS count FROM "${table}"`,
  );
  return Number(rows[0]?.count ?? 0);
}

async function seedRlsFixture(
  transaction: Prisma.TransactionClient,
): Promise<RlsFixture> {
  const fixture: RlsFixture = {
    tenantA: randomUUID(),
    tenantB: randomUUID(),
    tenantProbe: randomUUID(),
    actorA: randomUUID(),
    actorB: randomUUID(),
    actorProbe: randomUUID(),
    connectionA: randomUUID(),
    connectionB: randomUUID(),
  };
  const slug = (tenant: string) => `rls-fixture-${tenant}`;
  const provider = `rls-provider-${randomUUID()}`;

  await transaction.$executeRaw`
    INSERT INTO "workspaces" ("id", "name", "slug", "status", "onboarding_completed", "created_at", "updated_at")
    VALUES
      (${fixture.tenantA}, 'RLS fixture A', ${slug(fixture.tenantA)}, 'active', false, NOW(), NOW()),
      (${fixture.tenantB}, 'RLS fixture B', ${slug(fixture.tenantB)}, 'active', false, NOW(), NOW()),
      (${fixture.tenantProbe}, 'RLS fixture probe', ${slug(fixture.tenantProbe)}, 'active', false, NOW(), NOW())
  `;
  await transaction.$executeRaw`
    INSERT INTO "profiles" ("id", "email", "name", "locale", "tenant_id", "created_at", "updated_at")
    VALUES
      (${fixture.actorA}, ${`${fixture.actorA}@example.test`}, 'RLS actor A', 'pt-BR', ${fixture.tenantA}, NOW(), NOW()),
      (${fixture.actorB}, ${`${fixture.actorB}@example.test`}, 'RLS actor B', 'pt-BR', ${fixture.tenantB}, NOW(), NOW()),
      (${fixture.actorProbe}, ${`${fixture.actorProbe}@example.test`}, 'RLS actor probe', 'pt-BR', ${fixture.tenantProbe}, NOW(), NOW())
  `;
  await transaction.$executeRaw`
    INSERT INTO "ai_provider_connections" ("id", "tenant_id", "provider", "auth_method", "encrypted_secret", "default_model", "status", "created_by", "created_at", "updated_at")
    VALUES
      (${fixture.connectionA}, ${fixture.tenantA}, ${provider}, 'api_key', NULL, 'gpt-4o', 'active', ${fixture.actorA}, NOW(), NOW()),
      (${fixture.connectionB}, ${fixture.tenantB}, ${provider}, 'api_key', NULL, 'gpt-4o', 'active', ${fixture.actorB}, NOW(), NOW())
  `;
  await transaction.$executeRaw`
    INSERT INTO "ai_provider_connection_audits" ("id", "tenant_id", "provider", "action", "actor_id", "result", "metadata", "connection_id", "created_at")
    VALUES
      (${randomUUID()}, ${fixture.tenantA}, ${provider}, 'fixture', ${fixture.actorA}, 'success', ${JSON.stringify({ source: "rls-test" })}::jsonb, ${fixture.connectionA}, NOW()),
      (${randomUUID()}, ${fixture.tenantB}, ${provider}, 'fixture', ${fixture.actorB}, 'success', ${JSON.stringify({ source: "rls-test" })}::jsonb, ${fixture.connectionB}, NOW())
  `;
  await transaction.$executeRaw`
    INSERT INTO "workspace_directives" ("id", "tenant_id", "content", "updated_by", "created_at", "updated_at")
    VALUES
      (${randomUUID()}, ${fixture.tenantA}, 'RLS fixture A', ${fixture.actorA}, NOW(), NOW()),
      (${randomUUID()}, ${fixture.tenantB}, 'RLS fixture B', ${fixture.actorB}, NOW(), NOW())
  `;
  await transaction.$executeRaw`
    INSERT INTO "ai_studio_usage_events" ("id", "tenant_id", "actor_id", "provider", "auth_method", "model", "request_id", "prompt_base_version", "request_size_bytes", "response_size_bytes", "latency_ms", "status", "created_at")
    VALUES
      (${randomUUID()}, ${fixture.tenantA}, ${fixture.actorA}, ${provider}, 'api_key', 'gpt-4o', ${randomUUID()}, 'rls-test', 1, 1, 1, 'success', NOW()),
      (${randomUUID()}, ${fixture.tenantB}, ${fixture.actorB}, ${provider}, 'api_key', 'gpt-4o', ${randomUUID()}, 'rls-test', 1, 1, 1, 'success', NOW())
  `;
  await transaction.$executeRaw`
    INSERT INTO "ai_studio_consents" ("id", "tenant_id", "provider", "version", "consented_by", "consented_at", "created_at")
    VALUES
      (${randomUUID()}, ${fixture.tenantA}, ${provider}, ${`rls-${randomUUID()}`}, ${fixture.actorA}, NOW(), NOW()),
      (${randomUUID()}, ${fixture.tenantB}, ${provider}, ${`rls-${randomUUID()}`}, ${fixture.actorB}, NOW(), NOW())
  `;

  return fixture;
}

async function insertProbeRow(
  transaction: Prisma.TransactionClient,
  table: AIStudioTable,
  fixture: RlsFixture,
): Promise<unknown> {
  const provider = `rls-probe-${randomUUID()}`;
  switch (table) {
    case "ai_provider_connections":
      return transaction.$executeRaw`
        INSERT INTO "ai_provider_connections" ("id", "tenant_id", "provider", "auth_method", "encrypted_secret", "default_model", "status", "created_by", "created_at", "updated_at")
        VALUES (${randomUUID()}, ${fixture.tenantProbe}, ${provider}, 'api_key', NULL, 'gpt-4o', 'active', ${fixture.actorProbe}, NOW(), NOW())
      `;
    case "ai_provider_connection_audits":
      return transaction.$executeRaw`
        INSERT INTO "ai_provider_connection_audits" ("id", "tenant_id", "provider", "action", "actor_id", "result", "metadata", "connection_id", "created_at")
        VALUES (${randomUUID()}, ${fixture.tenantProbe}, ${provider}, 'probe', ${fixture.actorProbe}, 'success', '{}'::jsonb, ${fixture.connectionA}, NOW())
      `;
    case "workspace_directives":
      return transaction.$executeRaw`
        INSERT INTO "workspace_directives" ("id", "tenant_id", "content", "updated_by", "created_at", "updated_at")
        VALUES (${randomUUID()}, ${fixture.tenantProbe}, 'RLS probe', ${fixture.actorProbe}, NOW(), NOW())
      `;
    case "ai_studio_usage_events":
      return transaction.$executeRaw`
        INSERT INTO "ai_studio_usage_events" ("id", "tenant_id", "actor_id", "provider", "auth_method", "model", "request_id", "prompt_base_version", "request_size_bytes", "response_size_bytes", "latency_ms", "status", "created_at")
        VALUES (${randomUUID()}, ${fixture.tenantProbe}, ${fixture.actorProbe}, ${provider}, 'api_key', 'gpt-4o', ${randomUUID()}, 'rls-probe', 1, 1, 1, 'success', NOW())
      `;
    case "ai_studio_consents":
      return transaction.$executeRaw`
        INSERT INTO "ai_studio_consents" ("id", "tenant_id", "provider", "version", "consented_by", "consented_at", "created_at")
        VALUES (${randomUUID()}, ${fixture.tenantProbe}, ${provider}, ${`rls-${randomUUID()}`}, ${fixture.actorProbe}, NOW(), NOW())
      `;
  }
}

async function expectDeniedInsert(
  transaction: Prisma.TransactionClient,
  table: AIStudioTable,
  fixture: RlsFixture,
): Promise<void> {
  await transaction.$executeRaw`SAVEPOINT ai_studio_rls_insert`;
  let denied = false;
  try {
    await insertProbeRow(transaction, table, fixture);
  } catch {
    denied = true;
  }
  await transaction.$executeRaw`ROLLBACK TO SAVEPOINT ai_studio_rls_insert`;
  await transaction.$executeRaw`RELEASE SAVEPOINT ai_studio_rls_insert`;
  expect(denied).toBe(true);
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

  it("exercises cross-tenant reads and writes for all AI Studio tables", async (ctx) => {
    await withDb(ctx, async () => {
      const rollback = Symbol("rollback RLS fixture");
      try {
        await prisma.$transaction(async (transaction) => {
          const fixture = await seedRlsFixture(transaction);
          await transaction.$executeRaw`SET LOCAL ROLE authenticated`;
          const roles = await transaction.$queryRaw<Array<{ current_user: string }>>`SELECT current_user`;
          expect(roles[0]?.current_user).toBe("authenticated");

          await transaction.$executeRaw`RESET app.current_tenant_id`;
          const unset = await transaction.$queryRaw<Array<{ unset: boolean }>>`
            SELECT current_setting('app.current_tenant_id', true) IS NULL AS unset`;
          expect(unset[0]?.unset).toBe(true);
          for (const table of AI_STUDIO_TABLES) {
            expect(await countRows(transaction, table)).toBe(0);
            await expectDeniedInsert(transaction, table, fixture);
          }

          await transaction.$executeRaw`SELECT set_config('app.current_tenant_id', ${fixture.tenantA}, true)`;
          for (const table of AI_STUDIO_TABLES) {
            expect(await countRows(transaction, table)).toBe(1);
            await expectDeniedInsert(transaction, table, fixture);
            expect(
              await transaction.$executeRawUnsafe(
                `UPDATE "${table}" SET "tenant_id" = "tenant_id" WHERE "tenant_id" = $1`,
                fixture.tenantB,
              ),
            ).toBe(0);
            expect(
              await transaction.$executeRawUnsafe(
                `DELETE FROM "${table}" WHERE "tenant_id" = $1`,
                fixture.tenantB,
              ),
            ).toBe(0);
          }

          await transaction.$executeRaw`SELECT set_config('app.current_tenant_id', ${fixture.tenantB}, true)`;
          for (const table of AI_STUDIO_TABLES) {
            expect(await countRows(transaction, table)).toBe(1);
          }

          throw rollback;
        });
      } catch (error) {
        if (error !== rollback) throw error;
      }
    });
  });

  it("keeps the runtime policy catalog complete for all AI Studio tables", async (ctx) => {
    await withDb(ctx, async () => {
      const rows = await prisma.$queryRaw<{ tablename: string; policyname: string }[]>`
        SELECT tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'`;
      const policies = new Set(rows.map((row) => `${row.tablename}:${row.policyname}`));

      for (const table of AI_STUDIO_TABLES) {
        for (const policy of [
          "tenant_isolation_select",
          "tenant_isolation_insert",
          "tenant_isolation_update",
          "tenant_isolation_delete",
          "super_admin_bypass",
        ]) {
          expect(policies.has(`${table}:${policy}`)).toBe(true);
        }
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
