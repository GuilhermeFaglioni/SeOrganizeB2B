CREATE TABLE "ai_studio_managed_cycles" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "catalog_entry_id" TEXT NOT NULL,
    "model_version" INTEGER NOT NULL,
    "input_cost_micros" INTEGER NOT NULL,
    "output_cost_micros" INTEGER NOT NULL,
    "image_cost_micros" INTEGER NOT NULL,
    "credit_cost_per_cycle" INTEGER NOT NULL,
    "debit_operation_key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "alteration_count" INTEGER NOT NULL DEFAULT 0,
    "refunded_failure_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "last_candidate_html" TEXT,
    "detected_variables" JSONB NOT NULL DEFAULT '[]',
    "session_summary" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ai_studio_managed_cycles_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ai_studio_managed_cycles_status_check" CHECK ("status" IN ('active', 'saved', 'expired', 'exhausted')),
    CONSTRAINT "ai_studio_managed_cycles_alteration_count_check" CHECK ("alteration_count" BETWEEN 0 AND 5),
    CONSTRAINT "ai_studio_managed_cycles_refunded_failure_count_check" CHECK ("refunded_failure_count" BETWEEN 0 AND 3),
     CONSTRAINT "ai_studio_managed_cycles_cost_check" CHECK ("credit_cost_per_cycle" > 0 AND "input_cost_micros" >= 0 AND "output_cost_micros" >= 0 AND "image_cost_micros" >= 0)
);
CREATE UNIQUE INDEX "ai_studio_managed_cycles_debit_operation_key_key" ON "ai_studio_managed_cycles"("debit_operation_key");
CREATE INDEX "ai_studio_managed_cycles_tenant_id_actor_id_status_expires_at_idx" ON "ai_studio_managed_cycles"("tenant_id", "actor_id", "status", "expires_at");
CREATE INDEX "ai_studio_managed_cycles_tenant_id_created_at_idx" ON "ai_studio_managed_cycles"("tenant_id", "created_at");
ALTER TABLE "ai_studio_managed_cycles" ADD CONSTRAINT "ai_studio_managed_cycles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_studio_managed_cycles" ADD CONSTRAINT "ai_studio_managed_cycles_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ai_studio_managed_cycles" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_select" ON "ai_studio_managed_cycles" FOR SELECT USING (tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000'));
CREATE POLICY "tenant_isolation_insert" ON "ai_studio_managed_cycles" FOR INSERT WITH CHECK (tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000'));
CREATE POLICY "tenant_isolation_update" ON "ai_studio_managed_cycles" FOR UPDATE USING (tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000'));
CREATE POLICY "tenant_isolation_delete" ON "ai_studio_managed_cycles" FOR DELETE USING (tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000'));
CREATE POLICY "super_admin_bypass" ON "ai_studio_managed_cycles" FOR ALL USING (COALESCE(public.jwt_claim('super_admin')::boolean, false) = true);
