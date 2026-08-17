-- Closed Beta foundation: one internal plan, one global configuration and
-- durable participation/invitation/audit records.

ALTER TABLE "plans"
ADD COLUMN "is_internal" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "closed_beta_configs" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "status" TEXT NOT NULL DEFAULT 'paused',
    "max_primary_workspaces" INTEGER NOT NULL DEFAULT 30,
    "max_guests_per_workspace" INTEGER NOT NULL DEFAULT 3,
    "plan_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "closed_beta_configs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "closed_beta_enrollments" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "owner_profile_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "source" TEXT NOT NULL DEFAULT 'invitation',
    "previous_plan_id" TEXT,
    "consent_version" TEXT,
    "consented_at" TIMESTAMP(3),
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "closed_beta_enrollments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "closed_beta_invitations" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "reserved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "workspace_id" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_by_email" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "closed_beta_invitations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "closed_beta_audit_events" (
    "id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "actor_email" TEXT,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT,
    "before_value" JSONB,
    "after_value" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "closed_beta_audit_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "closed_beta_configs_plan_id_key"
ON "closed_beta_configs"("plan_id");
CREATE UNIQUE INDEX "closed_beta_enrollments_workspace_id_key"
ON "closed_beta_enrollments"("workspace_id");
CREATE UNIQUE INDEX "closed_beta_enrollments_owner_profile_id_key"
ON "closed_beta_enrollments"("owner_profile_id");
CREATE UNIQUE INDEX "closed_beta_invitations_token_hash_key"
ON "closed_beta_invitations"("token_hash");
CREATE INDEX "closed_beta_enrollments_status_idx"
ON "closed_beta_enrollments"("status");
CREATE INDEX "closed_beta_enrollments_owner_profile_id_idx"
ON "closed_beta_enrollments"("owner_profile_id");
CREATE INDEX "closed_beta_invitations_email_status_idx"
ON "closed_beta_invitations"("email", "status");
CREATE INDEX "closed_beta_invitations_status_expires_at_idx"
ON "closed_beta_invitations"("status", "expires_at");
CREATE INDEX "closed_beta_invitations_workspace_id_idx"
ON "closed_beta_invitations"("workspace_id");
CREATE INDEX "closed_beta_audit_events_created_at_idx"
ON "closed_beta_audit_events"("created_at");
CREATE INDEX "closed_beta_audit_events_target_type_target_id_idx"
ON "closed_beta_audit_events"("target_type", "target_id");
CREATE INDEX "closed_beta_audit_events_actor_user_id_created_at_idx"
ON "closed_beta_audit_events"("actor_user_id", "created_at");

ALTER TABLE "closed_beta_configs"
ADD CONSTRAINT "closed_beta_configs_plan_id_fkey"
FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "closed_beta_enrollments"
ADD CONSTRAINT "closed_beta_enrollments_workspace_id_fkey"
FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "closed_beta_enrollments"
ADD CONSTRAINT "closed_beta_enrollments_owner_profile_id_fkey"
FOREIGN KEY ("owner_profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "closed_beta_invitations"
ADD CONSTRAINT "closed_beta_invitations_workspace_id_fkey"
FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "plans" (
    "id",
    "name",
    "stripe_price_id",
    "allowedModules",
    "is_default",
    "is_active",
    "is_internal",
    "created_at",
    "updated_at"
)
VALUES (
    '00000000-0000-0000-0000-00000000cb01',
    'Closed Beta',
    NULL,
    '["tasks","projects","calendar","documents","financial.overview","financial.contracts","financial.proposals","financial.clients","financial.receivables","areas"]'::jsonb,
    false,
    true,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "closed_beta_configs" (
    "id",
    "status",
    "max_primary_workspaces",
    "max_guests_per_workspace",
    "plan_id",
    "created_at",
    "updated_at"
)
VALUES (
    'default',
    'paused',
    30,
    3,
    '00000000-0000-0000-0000-00000000cb01',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;
