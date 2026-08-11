-- T-015: Enable Row-Level Security (RLS) on all tenant-scoped tables.
--
-- RLS is a defense-in-depth layer for tenant isolation. The app connects via
-- Prisma as the table owner, which bypasses RLS; the real enforcement target is
-- the Supabase anon/authenticated roles and any non-owner connection. The
-- tenant_id column is the second layer of isolation on top of Supabase Auth.
--
-- The tenant_isolation_* policies compare against the custom GUC
-- 'app.current_tenant_id' (set by the application middleware per request). When
-- the setting is absent, current_setting(..., true) returns NULL and the policy
-- falls back to the zero-UUID so no rows are visible (deny by default).
--
-- The super_admin_bypass policy relies on jwt_claim(). On a full Supabase
-- install the canonical function is auth.jwt_claim(); this local Prisma-managed
-- Postgres does not expose it and the postgres role cannot write to the auth
-- schema (owned by supabase_admin). The DO block below creates a compatible
-- shim in the public schema only when it is absent, so the migration applies
-- cleanly in both environments. The shim reads the request.jwt.claims GUC that
-- Supabase populates per request.
--
-- Down path (reversible):
--   DROP POLICY IF EXISTS "super_admin_bypass"      ON <table>;
--   DROP POLICY IF EXISTS "tenant_isolation_select" ON <table>;
--   DROP POLICY IF EXISTS "tenant_isolation_insert" ON <table>;
--   DROP POLICY IF EXISTS "tenant_isolation_update" ON <table>;
--   DROP POLICY IF EXISTS "tenant_isolation_delete" ON <table>;
--   ALTER TABLE <table> DISABLE ROW LEVEL SECURITY;
--
DO $body$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'jwt_claim'
  ) THEN
    CREATE FUNCTION public.jwt_claim(claim_name text)
    RETURNS jsonb
    LANGUAGE sql
    STABLE
    AS $func$ SELECT COALESCE(current_setting('request.jwt.claims', true), '{}')::jsonb -> claim_name $func$;
  END IF;
END $body$;

-- ===== profiles =====
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON "profiles" FOR SELECT USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_insert" ON "profiles" FOR INSERT WITH CHECK (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_update" ON "profiles" FOR UPDATE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_delete" ON "profiles" FOR DELETE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "super_admin_bypass" ON "profiles" FOR ALL USING (
  COALESCE(public.jwt_claim('super_admin')::boolean, false) = true
);

COMMENT ON TABLE "profiles" IS 'RLS enabled (T-015): tenant_isolation_* policies gate access by app.current_tenant_id; super_admin_bypass allows super-admins. Defense-in-depth over Prisma-applied tenant scoping.';

-- ===== roles =====
ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON "roles" FOR SELECT USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_insert" ON "roles" FOR INSERT WITH CHECK (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_update" ON "roles" FOR UPDATE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_delete" ON "roles" FOR DELETE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "super_admin_bypass" ON "roles" FOR ALL USING (
  COALESCE(public.jwt_claim('super_admin')::boolean, false) = true
);

COMMENT ON TABLE "roles" IS 'RLS enabled (T-015): tenant_isolation_* policies gate access by app.current_tenant_id; super_admin_bypass allows super-admins. Defense-in-depth over Prisma-applied tenant scoping.';

-- ===== activities =====
ALTER TABLE "activities" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON "activities" FOR SELECT USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_insert" ON "activities" FOR INSERT WITH CHECK (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_update" ON "activities" FOR UPDATE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_delete" ON "activities" FOR DELETE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "super_admin_bypass" ON "activities" FOR ALL USING (
  COALESCE(public.jwt_claim('super_admin')::boolean, false) = true
);

COMMENT ON TABLE "activities" IS 'RLS enabled (T-015): tenant_isolation_* policies gate access by app.current_tenant_id; super_admin_bypass allows super-admins. Defense-in-depth over Prisma-applied tenant scoping.';

-- ===== calendar_auth =====
ALTER TABLE "calendar_auth" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON "calendar_auth" FOR SELECT USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_insert" ON "calendar_auth" FOR INSERT WITH CHECK (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_update" ON "calendar_auth" FOR UPDATE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_delete" ON "calendar_auth" FOR DELETE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "super_admin_bypass" ON "calendar_auth" FOR ALL USING (
  COALESCE(public.jwt_claim('super_admin')::boolean, false) = true
);

COMMENT ON TABLE "calendar_auth" IS 'RLS enabled (T-015): tenant_isolation_* policies gate access by app.current_tenant_id; super_admin_bypass allows super-admins. Defense-in-depth over Prisma-applied tenant scoping.';

-- ===== calendar_event_attendees =====
ALTER TABLE "calendar_event_attendees" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON "calendar_event_attendees" FOR SELECT USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_insert" ON "calendar_event_attendees" FOR INSERT WITH CHECK (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_update" ON "calendar_event_attendees" FOR UPDATE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_delete" ON "calendar_event_attendees" FOR DELETE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "super_admin_bypass" ON "calendar_event_attendees" FOR ALL USING (
  COALESCE(public.jwt_claim('super_admin')::boolean, false) = true
);

COMMENT ON TABLE "calendar_event_attendees" IS 'RLS enabled (T-015): tenant_isolation_* policies gate access by app.current_tenant_id; super_admin_bypass allows super-admins. Defense-in-depth over Prisma-applied tenant scoping.';

-- ===== calendar_events =====
ALTER TABLE "calendar_events" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON "calendar_events" FOR SELECT USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_insert" ON "calendar_events" FOR INSERT WITH CHECK (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_update" ON "calendar_events" FOR UPDATE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_delete" ON "calendar_events" FOR DELETE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "super_admin_bypass" ON "calendar_events" FOR ALL USING (
  COALESCE(public.jwt_claim('super_admin')::boolean, false) = true
);

COMMENT ON TABLE "calendar_events" IS 'RLS enabled (T-015): tenant_isolation_* policies gate access by app.current_tenant_id; super_admin_bypass allows super-admins. Defense-in-depth over Prisma-applied tenant scoping.';

-- ===== clients =====
ALTER TABLE "clients" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON "clients" FOR SELECT USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_insert" ON "clients" FOR INSERT WITH CHECK (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_update" ON "clients" FOR UPDATE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_delete" ON "clients" FOR DELETE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "super_admin_bypass" ON "clients" FOR ALL USING (
  COALESCE(public.jwt_claim('super_admin')::boolean, false) = true
);

COMMENT ON TABLE "clients" IS 'RLS enabled (T-015): tenant_isolation_* policies gate access by app.current_tenant_id; super_admin_bypass allows super-admins. Defense-in-depth over Prisma-applied tenant scoping.';

-- ===== comment_mentions =====
ALTER TABLE "comment_mentions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON "comment_mentions" FOR SELECT USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_insert" ON "comment_mentions" FOR INSERT WITH CHECK (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_update" ON "comment_mentions" FOR UPDATE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_delete" ON "comment_mentions" FOR DELETE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "super_admin_bypass" ON "comment_mentions" FOR ALL USING (
  COALESCE(public.jwt_claim('super_admin')::boolean, false) = true
);

COMMENT ON TABLE "comment_mentions" IS 'RLS enabled (T-015): tenant_isolation_* policies gate access by app.current_tenant_id; super_admin_bypass allows super-admins. Defense-in-depth over Prisma-applied tenant scoping.';

-- ===== comments =====
ALTER TABLE "comments" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON "comments" FOR SELECT USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_insert" ON "comments" FOR INSERT WITH CHECK (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_update" ON "comments" FOR UPDATE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_delete" ON "comments" FOR DELETE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "super_admin_bypass" ON "comments" FOR ALL USING (
  COALESCE(public.jwt_claim('super_admin')::boolean, false) = true
);

COMMENT ON TABLE "comments" IS 'RLS enabled (T-015): tenant_isolation_* policies gate access by app.current_tenant_id; super_admin_bypass allows super-admins. Defense-in-depth over Prisma-applied tenant scoping.';

-- ===== contract_audits =====
ALTER TABLE "contract_audits" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON "contract_audits" FOR SELECT USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_insert" ON "contract_audits" FOR INSERT WITH CHECK (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_update" ON "contract_audits" FOR UPDATE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_delete" ON "contract_audits" FOR DELETE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "super_admin_bypass" ON "contract_audits" FOR ALL USING (
  COALESCE(public.jwt_claim('super_admin')::boolean, false) = true
);

COMMENT ON TABLE "contract_audits" IS 'RLS enabled (T-015): tenant_isolation_* policies gate access by app.current_tenant_id; super_admin_bypass allows super-admins. Defense-in-depth over Prisma-applied tenant scoping.';

-- ===== contract_changes =====
ALTER TABLE "contract_changes" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON "contract_changes" FOR SELECT USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_insert" ON "contract_changes" FOR INSERT WITH CHECK (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_update" ON "contract_changes" FOR UPDATE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_delete" ON "contract_changes" FOR DELETE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "super_admin_bypass" ON "contract_changes" FOR ALL USING (
  COALESCE(public.jwt_claim('super_admin')::boolean, false) = true
);

COMMENT ON TABLE "contract_changes" IS 'RLS enabled (T-015): tenant_isolation_* policies gate access by app.current_tenant_id; super_admin_bypass allows super-admins. Defense-in-depth over Prisma-applied tenant scoping.';

-- ===== contract_items =====
ALTER TABLE "contract_items" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON "contract_items" FOR SELECT USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_insert" ON "contract_items" FOR INSERT WITH CHECK (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_update" ON "contract_items" FOR UPDATE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_delete" ON "contract_items" FOR DELETE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "super_admin_bypass" ON "contract_items" FOR ALL USING (
  COALESCE(public.jwt_claim('super_admin')::boolean, false) = true
);

COMMENT ON TABLE "contract_items" IS 'RLS enabled (T-015): tenant_isolation_* policies gate access by app.current_tenant_id; super_admin_bypass allows super-admins. Defense-in-depth over Prisma-applied tenant scoping.';

-- ===== contract_projects =====
ALTER TABLE "contract_projects" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON "contract_projects" FOR SELECT USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_insert" ON "contract_projects" FOR INSERT WITH CHECK (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_update" ON "contract_projects" FOR UPDATE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_delete" ON "contract_projects" FOR DELETE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "super_admin_bypass" ON "contract_projects" FOR ALL USING (
  COALESCE(public.jwt_claim('super_admin')::boolean, false) = true
);

COMMENT ON TABLE "contract_projects" IS 'RLS enabled (T-015): tenant_isolation_* policies gate access by app.current_tenant_id; super_admin_bypass allows super-admins. Defense-in-depth over Prisma-applied tenant scoping.';

-- ===== contracts =====
ALTER TABLE "contracts" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON "contracts" FOR SELECT USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_insert" ON "contracts" FOR INSERT WITH CHECK (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_update" ON "contracts" FOR UPDATE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_delete" ON "contracts" FOR DELETE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "super_admin_bypass" ON "contracts" FOR ALL USING (
  COALESCE(public.jwt_claim('super_admin')::boolean, false) = true
);

COMMENT ON TABLE "contracts" IS 'RLS enabled (T-015): tenant_isolation_* policies gate access by app.current_tenant_id; super_admin_bypass allows super-admins. Defense-in-depth over Prisma-applied tenant scoping.';

-- ===== documents =====
ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON "documents" FOR SELECT USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_insert" ON "documents" FOR INSERT WITH CHECK (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_update" ON "documents" FOR UPDATE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_delete" ON "documents" FOR DELETE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "super_admin_bypass" ON "documents" FOR ALL USING (
  COALESCE(public.jwt_claim('super_admin')::boolean, false) = true
);

COMMENT ON TABLE "documents" IS 'RLS enabled (T-015): tenant_isolation_* policies gate access by app.current_tenant_id; super_admin_bypass allows super-admins. Defense-in-depth over Prisma-applied tenant scoping.';

-- ===== installments =====
ALTER TABLE "installments" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON "installments" FOR SELECT USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_insert" ON "installments" FOR INSERT WITH CHECK (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_update" ON "installments" FOR UPDATE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_delete" ON "installments" FOR DELETE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "super_admin_bypass" ON "installments" FOR ALL USING (
  COALESCE(public.jwt_claim('super_admin')::boolean, false) = true
);

COMMENT ON TABLE "installments" IS 'RLS enabled (T-015): tenant_isolation_* policies gate access by app.current_tenant_id; super_admin_bypass allows super-admins. Defense-in-depth over Prisma-applied tenant scoping.';

-- ===== notifications =====
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON "notifications" FOR SELECT USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_insert" ON "notifications" FOR INSERT WITH CHECK (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_update" ON "notifications" FOR UPDATE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_delete" ON "notifications" FOR DELETE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "super_admin_bypass" ON "notifications" FOR ALL USING (
  COALESCE(public.jwt_claim('super_admin')::boolean, false) = true
);

COMMENT ON TABLE "notifications" IS 'RLS enabled (T-015): tenant_isolation_* policies gate access by app.current_tenant_id; super_admin_bypass allows super-admins. Defense-in-depth over Prisma-applied tenant scoping.';

-- ===== project_columns =====
ALTER TABLE "project_columns" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON "project_columns" FOR SELECT USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_insert" ON "project_columns" FOR INSERT WITH CHECK (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_update" ON "project_columns" FOR UPDATE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_delete" ON "project_columns" FOR DELETE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "super_admin_bypass" ON "project_columns" FOR ALL USING (
  COALESCE(public.jwt_claim('super_admin')::boolean, false) = true
);

COMMENT ON TABLE "project_columns" IS 'RLS enabled (T-015): tenant_isolation_* policies gate access by app.current_tenant_id; super_admin_bypass allows super-admins. Defense-in-depth over Prisma-applied tenant scoping.';

-- ===== projects =====
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON "projects" FOR SELECT USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_insert" ON "projects" FOR INSERT WITH CHECK (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_update" ON "projects" FOR UPDATE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_delete" ON "projects" FOR DELETE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "super_admin_bypass" ON "projects" FOR ALL USING (
  COALESCE(public.jwt_claim('super_admin')::boolean, false) = true
);

COMMENT ON TABLE "projects" IS 'RLS enabled (T-015): tenant_isolation_* policies gate access by app.current_tenant_id; super_admin_bypass allows super-admins. Defense-in-depth over Prisma-applied tenant scoping.';

-- ===== proposal_items =====
ALTER TABLE "proposal_items" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON "proposal_items" FOR SELECT USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_insert" ON "proposal_items" FOR INSERT WITH CHECK (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_update" ON "proposal_items" FOR UPDATE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_delete" ON "proposal_items" FOR DELETE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "super_admin_bypass" ON "proposal_items" FOR ALL USING (
  COALESCE(public.jwt_claim('super_admin')::boolean, false) = true
);

COMMENT ON TABLE "proposal_items" IS 'RLS enabled (T-015): tenant_isolation_* policies gate access by app.current_tenant_id; super_admin_bypass allows super-admins. Defense-in-depth over Prisma-applied tenant scoping.';

-- ===== proposal_templates =====
ALTER TABLE "proposal_templates" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON "proposal_templates" FOR SELECT USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_insert" ON "proposal_templates" FOR INSERT WITH CHECK (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_update" ON "proposal_templates" FOR UPDATE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_delete" ON "proposal_templates" FOR DELETE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "super_admin_bypass" ON "proposal_templates" FOR ALL USING (
  COALESCE(public.jwt_claim('super_admin')::boolean, false) = true
);

COMMENT ON TABLE "proposal_templates" IS 'RLS enabled (T-015): tenant_isolation_* policies gate access by app.current_tenant_id; super_admin_bypass allows super-admins. Defense-in-depth over Prisma-applied tenant scoping.';

-- ===== proposals =====
ALTER TABLE "proposals" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON "proposals" FOR SELECT USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_insert" ON "proposals" FOR INSERT WITH CHECK (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_update" ON "proposals" FOR UPDATE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_delete" ON "proposals" FOR DELETE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "super_admin_bypass" ON "proposals" FOR ALL USING (
  COALESCE(public.jwt_claim('super_admin')::boolean, false) = true
);

COMMENT ON TABLE "proposals" IS 'RLS enabled (T-015): tenant_isolation_* policies gate access by app.current_tenant_id; super_admin_bypass allows super-admins. Defense-in-depth over Prisma-applied tenant scoping.';

-- ===== push_subscriptions =====
ALTER TABLE "push_subscriptions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON "push_subscriptions" FOR SELECT USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_insert" ON "push_subscriptions" FOR INSERT WITH CHECK (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_update" ON "push_subscriptions" FOR UPDATE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_delete" ON "push_subscriptions" FOR DELETE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "super_admin_bypass" ON "push_subscriptions" FOR ALL USING (
  COALESCE(public.jwt_claim('super_admin')::boolean, false) = true
);

COMMENT ON TABLE "push_subscriptions" IS 'RLS enabled (T-015): tenant_isolation_* policies gate access by app.current_tenant_id; super_admin_bypass allows super-admins. Defense-in-depth over Prisma-applied tenant scoping.';

-- ===== saved_views =====
ALTER TABLE "saved_views" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON "saved_views" FOR SELECT USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_insert" ON "saved_views" FOR INSERT WITH CHECK (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_update" ON "saved_views" FOR UPDATE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_delete" ON "saved_views" FOR DELETE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "super_admin_bypass" ON "saved_views" FOR ALL USING (
  COALESCE(public.jwt_claim('super_admin')::boolean, false) = true
);

COMMENT ON TABLE "saved_views" IS 'RLS enabled (T-015): tenant_isolation_* policies gate access by app.current_tenant_id; super_admin_bypass allows super-admins. Defense-in-depth over Prisma-applied tenant scoping.';

-- ===== task_assignees =====
ALTER TABLE "task_assignees" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON "task_assignees" FOR SELECT USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_insert" ON "task_assignees" FOR INSERT WITH CHECK (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_update" ON "task_assignees" FOR UPDATE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_delete" ON "task_assignees" FOR DELETE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "super_admin_bypass" ON "task_assignees" FOR ALL USING (
  COALESCE(public.jwt_claim('super_admin')::boolean, false) = true
);

COMMENT ON TABLE "task_assignees" IS 'RLS enabled (T-015): tenant_isolation_* policies gate access by app.current_tenant_id; super_admin_bypass allows super-admins. Defense-in-depth over Prisma-applied tenant scoping.';

-- ===== tasks =====
ALTER TABLE "tasks" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON "tasks" FOR SELECT USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_insert" ON "tasks" FOR INSERT WITH CHECK (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_update" ON "tasks" FOR UPDATE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_delete" ON "tasks" FOR DELETE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "super_admin_bypass" ON "tasks" FOR ALL USING (
  COALESCE(public.jwt_claim('super_admin')::boolean, false) = true
);

COMMENT ON TABLE "tasks" IS 'RLS enabled (T-015): tenant_isolation_* policies gate access by app.current_tenant_id; super_admin_bypass allows super-admins. Defense-in-depth over Prisma-applied tenant scoping.';

-- ===== team_areas =====
ALTER TABLE "team_areas" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON "team_areas" FOR SELECT USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_insert" ON "team_areas" FOR INSERT WITH CHECK (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_update" ON "team_areas" FOR UPDATE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_delete" ON "team_areas" FOR DELETE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "super_admin_bypass" ON "team_areas" FOR ALL USING (
  COALESCE(public.jwt_claim('super_admin')::boolean, false) = true
);

COMMENT ON TABLE "team_areas" IS 'RLS enabled (T-015): tenant_isolation_* policies gate access by app.current_tenant_id; super_admin_bypass allows super-admins. Defense-in-depth over Prisma-applied tenant scoping.';

-- ===== team_member_areas =====
ALTER TABLE "team_member_areas" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON "team_member_areas" FOR SELECT USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_insert" ON "team_member_areas" FOR INSERT WITH CHECK (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_update" ON "team_member_areas" FOR UPDATE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_delete" ON "team_member_areas" FOR DELETE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "super_admin_bypass" ON "team_member_areas" FOR ALL USING (
  COALESCE(public.jwt_claim('super_admin')::boolean, false) = true
);

COMMENT ON TABLE "team_member_areas" IS 'RLS enabled (T-015): tenant_isolation_* policies gate access by app.current_tenant_id; super_admin_bypass allows super-admins. Defense-in-depth over Prisma-applied tenant scoping.';

