import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const migration = readFileSync(
  resolve(__dirname, "../migrations/20260811160847_enable_rls/migration.sql"),
  "utf-8"
);

const TENANT_TABLES = [
  "profiles",
  "roles",
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

describe("RLS policies migration (T-015)", () => {
  it.each(TENANT_TABLES)("enables RLS on %s", (table) => {
    expect(migration).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
  });

  it.each(TENANT_TABLES)("creates tenant_isolation policies on %s", (table) => {
    expect(migration).toContain(
      `CREATE POLICY "tenant_isolation_select" ON "${table}" FOR SELECT USING`
    );
    expect(migration).toContain(
      `CREATE POLICY "tenant_isolation_insert" ON "${table}" FOR INSERT WITH CHECK`
    );
    expect(migration).toContain(
      `CREATE POLICY "tenant_isolation_update" ON "${table}" FOR UPDATE USING`
    );
    expect(migration).toContain(
      `CREATE POLICY "tenant_isolation_delete" ON "${table}" FOR DELETE USING`
    );
  });

  it.each(TENANT_TABLES)("creates a super_admin bypass policy on %s", (table) => {
    expect(migration).toContain(
      `CREATE POLICY "super_admin_bypass" ON "${table}" FOR ALL USING`
    );
  });

  it("does not enable RLS on global tables without tenant_id", () => {
    for (const table of ["workspaces", "plans", "plan_limits", "project_members"]) {
      expect(migration).not.toContain(
        `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`
      );
    }
  });

  it("treats RLS as defense-in-depth with a comment", () => {
    expect(migration).toMatch(/defense-in-depth/i);
  });

  it("compares tenant_id as text and handles an unset GUC gracefully", () => {
    const selectPolicy = migration.match(
      /CREATE POLICY "tenant_isolation_select" ON "tasks" FOR SELECT USING \(([\s\S]*?)\);/
    )?.[1];

    expect(selectPolicy).toBeDefined();
    expect(selectPolicy).toContain("current_setting('app.current_tenant_id', true)");
    expect(selectPolicy).toContain("00000000-0000-0000-0000-000000000000");
    expect(selectPolicy).not.toContain("::uuid");
  });
});