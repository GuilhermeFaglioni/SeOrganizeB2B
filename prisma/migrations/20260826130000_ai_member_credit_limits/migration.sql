CREATE TABLE "ai_member_credit_limits" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "monthly_limit" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_member_credit_limits_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ai_member_credit_limits_monthly_limit_check" CHECK ("monthly_limit" >= 0)
);
CREATE UNIQUE INDEX "ai_member_credit_limits_profile_id_key" ON "ai_member_credit_limits"("profile_id");
CREATE UNIQUE INDEX "ai_member_credit_limits_tenant_id_profile_id_key" ON "ai_member_credit_limits"("tenant_id", "profile_id");
CREATE INDEX "ai_member_credit_limits_tenant_id_idx" ON "ai_member_credit_limits"("tenant_id");
ALTER TABLE "ai_member_credit_limits" ADD CONSTRAINT "ai_member_credit_limits_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_member_credit_limits" ADD CONSTRAINT "ai_member_credit_limits_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_member_credit_limits" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_select" ON "ai_member_credit_limits" FOR SELECT USING (tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000'));
CREATE POLICY "tenant_isolation_insert" ON "ai_member_credit_limits" FOR INSERT WITH CHECK (tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000'));
CREATE POLICY "tenant_isolation_update" ON "ai_member_credit_limits" FOR UPDATE USING (tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000'));
CREATE POLICY "tenant_isolation_delete" ON "ai_member_credit_limits" FOR DELETE USING (tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000'));
CREATE POLICY "super_admin_bypass" ON "ai_member_credit_limits" FOR ALL USING (COALESCE(public.jwt_claim('super_admin')::boolean, false) = true);
