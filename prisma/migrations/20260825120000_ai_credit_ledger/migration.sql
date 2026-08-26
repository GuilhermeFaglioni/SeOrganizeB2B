CREATE TABLE "ai_credit_ledger_entries" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "actor_id" TEXT,
    "pool" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "operation_key" TEXT NOT NULL,
    "source_id" TEXT,
    "billing_period" TEXT,
    "reason" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_credit_ledger_entries_pkey" PRIMARY KEY ("id")
    ,CONSTRAINT "ai_credit_ledger_entries_quantity_check" CHECK ("quantity" <> 0)
    ,CONSTRAINT "ai_credit_ledger_entries_pool_check" CHECK ("pool" IN ('promotional', 'subscription', 'purchased'))
    ,CONSTRAINT "ai_credit_ledger_entries_kind_check" CHECK ("kind" IN ('subscription_grant', 'purchased_grant', 'promotional_grant', 'cycle_debit', 'expiration', 'refund', 'adjustment'))
);

CREATE UNIQUE INDEX "ai_credit_ledger_entries_tenant_id_operation_key_pool_key"
ON "ai_credit_ledger_entries"("tenant_id", "operation_key", "pool");
CREATE INDEX "ai_credit_ledger_entries_tenant_id_created_at_idx"
ON "ai_credit_ledger_entries"("tenant_id", "created_at");
CREATE INDEX "ai_credit_ledger_entries_tenant_id_pool_expires_at_idx"
ON "ai_credit_ledger_entries"("tenant_id", "pool", "expires_at");

ALTER TABLE "ai_credit_ledger_entries"
ADD CONSTRAINT "ai_credit_ledger_entries_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_credit_ledger_entries"
ADD CONSTRAINT "ai_credit_ledger_entries_actor_id_fkey"
FOREIGN KEY ("actor_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ai_credit_ledger_entries" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_select" ON "ai_credit_ledger_entries" FOR SELECT USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_insert" ON "ai_credit_ledger_entries" FOR INSERT WITH CHECK (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_update" ON "ai_credit_ledger_entries" FOR UPDATE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_delete" ON "ai_credit_ledger_entries" FOR DELETE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "super_admin_bypass" ON "ai_credit_ledger_entries" FOR ALL USING (
  COALESCE(public.jwt_claim('super_admin')::boolean, false) = true
);

CREATE OR REPLACE FUNCTION prevent_ai_credit_ledger_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'AI credit ledger entries are immutable';
END;
$$;

CREATE TRIGGER ai_credit_ledger_entries_immutable
BEFORE UPDATE OR DELETE ON "ai_credit_ledger_entries"
FOR EACH ROW EXECUTE FUNCTION prevent_ai_credit_ledger_mutation();
