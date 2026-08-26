import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const schema = readFileSync(resolve(__dirname, "../schema.prisma"), "utf8");
const migration = readFileSync(
  resolve(__dirname, "../migrations/20260825120000_ai_credit_ledger/migration.sql"),
  "utf8",
);

describe("AI credit ledger schema contract", () => {
  it("defines an immutable tenant-scoped ledger entry", () => {
    const model = schema.match(/model AiCreditLedgerEntry \{([\s\S]*?)\n\}/)?.[1];

    expect(model).toBeDefined();
    expect(model).toContain('tenantId      String    @map("tenant_id")');
    expect(model).toContain('actorId       String?   @map("actor_id")');
    expect(model).toContain("pool          String");
    expect(model).toContain("kind          String");
    expect(model).toContain("quantity      Int");
    expect(model).toContain('operationKey  String    @map("operation_key")');
    expect(model).toContain('sourceId      String?   @map("source_id")');
    expect(model).toContain('billingPeriod String?   @map("billing_period")');
    expect(model).toContain('metadata      Json      @default("{}")');
    expect(model).toContain('@@unique([tenantId, operationKey, pool])');
    expect(model).toContain('@@map("ai_credit_ledger_entries")');
  });

  it("installs tenant isolation, idempotency and database immutability", () => {
    expect(migration).toContain('CREATE TABLE "ai_credit_ledger_entries"');
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "ai_credit_ledger_entries_tenant_id_operation_key_pool_key"',
    );
    expect(migration).toContain(
      'ALTER TABLE "ai_credit_ledger_entries" ENABLE ROW LEVEL SECURITY;',
    );
    expect(migration).toContain(
      'CREATE POLICY "tenant_isolation_select" ON "ai_credit_ledger_entries" FOR SELECT USING',
    );
    expect(migration).toContain(
      'CREATE POLICY "tenant_isolation_insert" ON "ai_credit_ledger_entries" FOR INSERT WITH CHECK',
    );
    expect(migration).toContain(
      'CREATE POLICY "tenant_isolation_update" ON "ai_credit_ledger_entries" FOR UPDATE USING',
    );
    expect(migration).toContain(
      'CREATE POLICY "tenant_isolation_delete" ON "ai_credit_ledger_entries" FOR DELETE USING',
    );
    expect(migration).toContain(
      'CREATE POLICY "super_admin_bypass" ON "ai_credit_ledger_entries" FOR ALL USING',
    );
    expect(migration).toContain("prevent_ai_credit_ledger_mutation");
    expect(migration).toContain('CHECK ("quantity" <> 0)');
    expect(migration).toContain("current_setting('app.current_tenant_id', true)");
  });
});
