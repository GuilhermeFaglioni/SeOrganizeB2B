-- AI Studio #171: redacted operational usage and versioned provider consent.
-- No prompt, HTML, transcript, image bytes or provider secret is persisted.

CREATE TABLE "ai_studio_usage_events" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "auth_method" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "prompt_base_version" TEXT NOT NULL,
    "request_size_bytes" INTEGER NOT NULL,
    "response_size_bytes" INTEGER NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "error_category" TEXT,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_studio_usage_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_studio_consents" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "consented_by" TEXT NOT NULL,
    "consented_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_studio_consents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_studio_usage_events_request_id_key"
ON "ai_studio_usage_events"("request_id");
CREATE INDEX "ai_studio_usage_events_tenant_id_created_at_idx"
ON "ai_studio_usage_events"("tenant_id", "created_at");
CREATE INDEX "ai_studio_usage_events_tenant_id_actor_id_created_at_idx"
ON "ai_studio_usage_events"("tenant_id", "actor_id", "created_at");
CREATE UNIQUE INDEX "ai_studio_consents_tenant_id_provider_version_key"
ON "ai_studio_consents"("tenant_id", "provider", "version");
CREATE INDEX "ai_studio_consents_tenant_id_provider_consented_at_idx"
ON "ai_studio_consents"("tenant_id", "provider", "consented_at");

ALTER TABLE "ai_studio_usage_events"
ADD CONSTRAINT "ai_studio_usage_events_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_studio_usage_events"
ADD CONSTRAINT "ai_studio_usage_events_actor_id_fkey"
FOREIGN KEY ("actor_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ai_studio_consents"
ADD CONSTRAINT "ai_studio_consents_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_studio_consents"
ADD CONSTRAINT "ai_studio_consents_consented_by_fkey"
FOREIGN KEY ("consented_by") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Defense-in-depth tenant isolation for non-owner connections.
ALTER TABLE "ai_studio_usage_events" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_select" ON "ai_studio_usage_events" FOR SELECT USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_insert" ON "ai_studio_usage_events" FOR INSERT WITH CHECK (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_update" ON "ai_studio_usage_events" FOR UPDATE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_delete" ON "ai_studio_usage_events" FOR DELETE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "super_admin_bypass" ON "ai_studio_usage_events" FOR ALL USING (
  COALESCE(public.jwt_claim('super_admin')::boolean, false) = true
);

ALTER TABLE "ai_studio_consents" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_select" ON "ai_studio_consents" FOR SELECT USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_insert" ON "ai_studio_consents" FOR INSERT WITH CHECK (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_update" ON "ai_studio_consents" FOR UPDATE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "tenant_isolation_delete" ON "ai_studio_consents" FOR DELETE USING (
  tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000')
);
CREATE POLICY "super_admin_bypass" ON "ai_studio_consents" FOR ALL USING (
  COALESCE(public.jwt_claim('super_admin')::boolean, false) = true
);
