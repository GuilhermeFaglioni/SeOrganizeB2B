-- AI Studio: workspace-level AI provider connections and their lifecycle audit.
--
-- A workspace holds at most one connection per provider (unique on tenant_id +
-- provider). The provider secret is stored encrypted (encrypted_secret) and is
-- never returned to clients; the audit table records connection lifecycle
-- actions without secret material.

CREATE TABLE "ai_provider_connections" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "auth_method" TEXT NOT NULL DEFAULT 'api_key',
    "encrypted_secret" TEXT,
    "default_model" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_by" TEXT NOT NULL,
    "validated_at" TIMESTAMP(3),
    "last_error_code" TEXT,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_provider_connections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_provider_connection_audits" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor_id" TEXT,
    "result" TEXT NOT NULL DEFAULT 'success',
    "metadata" JSONB,
    "connection_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_provider_connection_audits_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_provider_connections_tenant_id_provider_key"
ON "ai_provider_connections"("tenant_id", "provider");
CREATE INDEX "ai_provider_connections_tenant_id_idx"
ON "ai_provider_connections"("tenant_id");
CREATE INDEX "ai_provider_connection_audits_tenant_id_created_at_idx"
ON "ai_provider_connection_audits"("tenant_id", "created_at");
CREATE INDEX "ai_provider_connection_audits_provider_idx"
ON "ai_provider_connection_audits"("provider");
CREATE INDEX "ai_provider_connection_audits_connection_id_idx"
ON "ai_provider_connection_audits"("connection_id");

ALTER TABLE "ai_provider_connections"
ADD CONSTRAINT "ai_provider_connections_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_provider_connections"
ADD CONSTRAINT "ai_provider_connections_created_by_fkey"
FOREIGN KEY ("created_by") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ai_provider_connection_audits"
ADD CONSTRAINT "ai_provider_connection_audits_connection_id_fkey"
FOREIGN KEY ("connection_id") REFERENCES "ai_provider_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_provider_connection_audits"
ADD CONSTRAINT "ai_provider_connection_audits_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_provider_connection_audits"
ADD CONSTRAINT "ai_provider_connection_audits_actor_id_fkey"
FOREIGN KEY ("actor_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
