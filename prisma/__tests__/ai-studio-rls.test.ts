import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = [
  "20260821140000_ai_provider_connections",
  "20260821150000_workspace_ai_directive",
  "20260821160000_ai_studio_text_generation",
  "20260822100000_ai_studio_hardening",
]
  .map((migrationName) =>
    readFileSync(resolve(__dirname, `../migrations/${migrationName}/migration.sql`), "utf8"),
  )
  .join("\n");

const AI_STUDIO_TABLES = [
  "ai_provider_connections",
  "ai_provider_connection_audits",
  "workspace_directives",
  "ai_studio_usage_events",
  "ai_studio_consents",
] as const;

describe("AI Studio hardening RLS migration", () => {
  it.each(AI_STUDIO_TABLES)("enables tenant isolation on %s", (table) => {
    expect(migration).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
    expect(migration).toContain(`CREATE POLICY "tenant_isolation_select" ON "${table}" FOR SELECT USING`);
    expect(migration).toContain(`CREATE POLICY "tenant_isolation_insert" ON "${table}" FOR INSERT WITH CHECK`);
    expect(migration).toContain(`CREATE POLICY "tenant_isolation_update" ON "${table}" FOR UPDATE USING`);
    expect(migration).toContain(`CREATE POLICY "tenant_isolation_delete" ON "${table}" FOR DELETE USING`);
    expect(migration).toContain(`CREATE POLICY "super_admin_bypass" ON "${table}" FOR ALL USING`);
  });

  it("fails closed when no tenant GUC is set", () => {
    expect(migration).toContain("current_setting('app.current_tenant_id', true)");
    expect(migration).toContain("00000000-0000-0000-0000-000000000000");
    expect(migration).not.toContain("::uuid");
  });
});
