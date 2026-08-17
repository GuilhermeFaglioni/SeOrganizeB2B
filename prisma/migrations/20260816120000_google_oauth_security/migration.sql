ALTER TABLE "calendar_auth" ADD COLUMN "google_subject" TEXT;

CREATE UNIQUE INDEX "calendar_auth_tenant_id_google_subject_key"
  ON "calendar_auth"("tenant_id", "google_subject");

CREATE TABLE "calendar_oauth_attempts" (
  "id" TEXT NOT NULL,
  "state_hash" TEXT NOT NULL,
  "code_verifier" TEXT NOT NULL,
  "nonce_hash" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "consumed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "calendar_oauth_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "calendar_oauth_attempts_state_hash_key"
  ON "calendar_oauth_attempts"("state_hash");

CREATE INDEX "calendar_oauth_attempts_user_id_expires_at_idx"
  ON "calendar_oauth_attempts"("user_id", "expires_at");

CREATE INDEX "calendar_oauth_attempts_tenant_id_expires_at_idx"
  ON "calendar_oauth_attempts"("tenant_id", "expires_at");

ALTER TABLE "calendar_oauth_attempts"
  ADD CONSTRAINT "calendar_oauth_attempts_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "calendar_oauth_attempts"
  ADD CONSTRAINT "calendar_oauth_attempts_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "calendar_oauth_attempts" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON "calendar_oauth_attempts" FOR SELECT USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);

CREATE POLICY "tenant_isolation_insert" ON "calendar_oauth_attempts" FOR INSERT WITH CHECK (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);

CREATE POLICY "tenant_isolation_update" ON "calendar_oauth_attempts" FOR UPDATE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);

CREATE POLICY "tenant_isolation_delete" ON "calendar_oauth_attempts" FOR DELETE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);

CREATE POLICY "super_admin_bypass" ON "calendar_oauth_attempts" FOR ALL USING (
  COALESCE(public.jwt_claim('super_admin')::boolean, false) = true
);
