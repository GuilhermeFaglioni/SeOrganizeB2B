-- AI Studio #176: defense-in-depth RLS for provider configuration and directives.
-- Application tenant middleware remains the primary authorization boundary.

ALTER TABLE "ai_provider_connections" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_select" ON "ai_provider_connections" FOR SELECT USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_insert" ON "ai_provider_connections" FOR INSERT WITH CHECK (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_update" ON "ai_provider_connections" FOR UPDATE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_delete" ON "ai_provider_connections" FOR DELETE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "super_admin_bypass" ON "ai_provider_connections" FOR ALL USING (
  COALESCE(public.jwt_claim('super_admin')::boolean, false) = true
);

ALTER TABLE "ai_provider_connection_audits" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_select" ON "ai_provider_connection_audits" FOR SELECT USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_insert" ON "ai_provider_connection_audits" FOR INSERT WITH CHECK (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_update" ON "ai_provider_connection_audits" FOR UPDATE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_delete" ON "ai_provider_connection_audits" FOR DELETE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-000000000000')
);
CREATE POLICY "super_admin_bypass" ON "ai_provider_connection_audits" FOR ALL USING (
  COALESCE(public.jwt_claim('super_admin')::boolean, false) = true
);

ALTER TABLE "workspace_directives" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_select" ON "workspace_directives" FOR SELECT USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_insert" ON "workspace_directives" FOR INSERT WITH CHECK (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_update" ON "workspace_directives" FOR UPDATE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_delete" ON "workspace_directives" FOR DELETE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "super_admin_bypass" ON "workspace_directives" FOR ALL USING (
  COALESCE(public.jwt_claim('super_admin')::boolean, false) = true
);
