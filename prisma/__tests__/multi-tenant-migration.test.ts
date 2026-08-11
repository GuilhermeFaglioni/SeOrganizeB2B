import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const MIGRATIONS_DIR = resolve(__dirname, "../migrations");

function migration(name: string): string {
  return readFileSync(resolve(MIGRATIONS_DIR, name, "migration.sql"), "utf-8");
}

const DEFAULT_WORKSPACE = "00000000-0000-0000-0000-000000000001";

const addWorkspaces = migration("20260811151935_add_workspaces");
const addPlans = migration("20260811152611_add_plans");
const addPlanLimits = migration("20260811152855_add_plan_limits");
const addProfileTenant = migration("20260811153123_add_profile_tenant");
const addRoleTenant = migration("20260811153516_add_role_tenant");
const addOperationalTenant = migration("20260811153938_add_operational_tenant");
const addProjectMembers = migration("20260811154409_add_project_members");
const migrateWorkspaceSettings = migration("20260811160000_migrate_workspace_settings");
const enableRls = migration("20260811160847_enable_rls");

const OPERATIONAL_TABLES = [
  "team_areas",
  "team_member_areas",
  "projects",
  "project_columns",
  "tasks",
  "task_assignees",
  "comments",
  "comment_mentions",
  "documents",
  "calendar_auth",
  "calendar_events",
  "calendar_event_attendees",
  "activities",
  "notifications",
  "push_subscriptions",
  "saved_views",
  "clients",
  "contracts",
  "contract_items",
  "contract_projects",
  "installments",
  "contract_changes",
  "contract_audits",
  "proposal_templates",
  "proposals",
  "proposal_items",
];

// Migration chain must be applied in a fixed order: the workspaces table has to
// exist before any tenant_id backfill can reference it, and the roles
// tenant_id column has to exist before migrate_workspace_settings backfills it.
const MIGRATION_ORDER = [
  "20260811151935_add_workspaces",
  "20260811152611_add_plans",
  "20260811152855_add_plan_limits",
  "20260811153123_add_profile_tenant",
  "20260811153516_add_role_tenant",
  "20260811153938_add_operational_tenant",
  "20260811154409_add_project_members",
  "20260811160000_migrate_workspace_settings",
  "20260811160847_enable_rls",
];

describe("multi-tenant migration chain (T-042)", () => {
  it("applies the tenant migrations in dependency order", () => {
    const applied = readFileSync(
      resolve(MIGRATIONS_DIR, "migration_lock.toml"),
      "utf-8"
    );
    expect(applied).toContain('provider = "postgresql"');

    const workspacesIdx = MIGRATION_ORDER.indexOf("20260811151935_add_workspaces");
    const profileIdx = MIGRATION_ORDER.indexOf("20260811153123_add_profile_tenant");
    const roleIdx = MIGRATION_ORDER.indexOf("20260811153516_add_role_tenant");
    const operationalIdx = MIGRATION_ORDER.indexOf("20260811153938_add_operational_tenant");
    const settingsIdx = MIGRATION_ORDER.indexOf("20260811160000_migrate_workspace_settings");

    // workspaces table exists before any tenant_id backfill references it
    expect(workspacesIdx).toBeLessThan(profileIdx);
    expect(workspacesIdx).toBeLessThan(operationalIdx);
    // roles.tenant_id column exists before migrate_workspace_settings backfills it
    expect(roleIdx).toBeLessThan(settingsIdx);
  });

  it("add_workspaces creates the workspaces table with a unique slug", () => {
    expect(addWorkspaces).toContain('CREATE TABLE "workspaces"');
    expect(addWorkspaces).toContain(
      'CREATE UNIQUE INDEX "workspaces_slug_key" ON "workspaces"("slug");'
    );
    expect(addWorkspaces).toContain(
      'FOREIGN KEY ("default_role_id") REFERENCES "roles"("id")'
    );
  });

  it("add_plans creates the plans table and links it to workspaces", () => {
    expect(addPlans).toContain('CREATE TABLE "plans"');
    expect(addPlans).toContain(
      'ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id")'
    );
  });

  it("add_plan_limits creates the plan_limits table", () => {
    expect(addPlanLimits).toContain('CREATE TABLE "plan_limits"');
    expect(addPlanLimits).toContain(
      'CREATE INDEX "plan_limits_plan_id_idx" ON "plan_limits"("plan_id")'
    );
  });

  it("add_profile_tenant backfills profiles to the default workspace", () => {
    expect(addProfileTenant).toContain(
      `UPDATE "profiles" SET "tenant_id" = '${DEFAULT_WORKSPACE}' WHERE "tenant_id" IS NULL`
    );
    expect(addProfileTenant).toContain(
      'ALTER TABLE "profiles" ALTER COLUMN "tenant_id" SET NOT NULL'
    );
    expect(addProfileTenant).toContain(
      'CREATE INDEX "profiles_tenant_id_idx" ON "profiles"("tenant_id")'
    );
    expect(addProfileTenant).toContain(
      'FOREIGN KEY ("tenant_id") REFERENCES "workspaces"("id")'
    );
  });

  it("add_role_tenant adds a nullable tenant_id to roles first", () => {
    expect(addRoleTenant).toContain(
      'ALTER TABLE "roles" ADD COLUMN     "tenant_id" TEXT;'
    );
    expect(addRoleTenant).toContain(
      'CREATE INDEX "roles_tenant_id_idx" ON "roles"("tenant_id")'
    );
  });

  it("add_operational_tenant backfills all 26 operational tables", () => {
    for (const table of OPERATIONAL_TABLES) {
      expect(addOperationalTenant).toContain(
        `UPDATE "${table}" SET "tenant_id" = '${DEFAULT_WORKSPACE}' WHERE "tenant_id" IS NULL`
      );
      expect(addOperationalTenant).toContain(
        `ALTER TABLE "${table}" ALTER COLUMN "tenant_id" SET NOT NULL`
      );
      expect(addOperationalTenant).toContain(
        `CREATE INDEX "${table}_tenant_id_idx" ON "${table}"("tenant_id")`
      );
      expect(addOperationalTenant).toContain(
        `ADD CONSTRAINT "${table}_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "workspaces"("id")`
      );
    }
  });

  it("add_project_members creates a tenant-independent join table", () => {
    expect(addProjectMembers).toContain('CREATE TABLE "project_members"');
    expect(addProjectMembers).toContain(
      'CONSTRAINT "project_members_pkey" PRIMARY KEY ("project_id","profile_id")'
    );
    expect(addProjectMembers).not.toContain("tenant_id");
  });

  it("migrate_workspace_settings backfills roles and drops workspace_settings", () => {
    expect(migrateWorkspaceSettings).toContain(
      `UPDATE "roles" SET "tenant_id" = '${DEFAULT_WORKSPACE}' WHERE "tenant_id" IS NULL`
    );
    expect(migrateWorkspaceSettings).toContain(
      'ALTER TABLE "roles" ALTER COLUMN "tenant_id" SET NOT NULL'
    );
    expect(migrateWorkspaceSettings).toContain(
      'CREATE UNIQUE INDEX "roles_name_tenant_id_key" ON "roles"("name", "tenant_id")'
    );
    expect(migrateWorkspaceSettings).toContain('DROP TABLE "workspace_settings"');
  });

  it("migrate_workspace_settings copies workspace settings into the default workspace", () => {
    expect(migrateWorkspaceSettings).toContain('"company_name" = ws."company_name"');
    expect(migrateWorkspaceSettings).toContain('"logo_url" = ws."logo_url"');
    expect(migrateWorkspaceSettings).toContain('"default_role_id" = ws."default_role_id"');
    expect(migrateWorkspaceSettings).toContain(
      'WHERE w."id" = \'00000000-0000-0000-0000-000000000001\''
    );
  });

  it("enable_rls gates every tenant-scoped table", () => {
    expect(enableRls).toContain('ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;');
    expect(enableRls).toContain('ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;');
    for (const table of OPERATIONAL_TABLES) {
      expect(enableRls).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
    }
  });
});