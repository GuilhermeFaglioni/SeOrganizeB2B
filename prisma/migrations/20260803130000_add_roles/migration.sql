-- Custom roles and permissioning.
-- Adds a roles table (Admin is a fixed, non-editable role), a role_id on
-- profiles (global per-workspace role) and a default_role_id on workspace
-- settings (applied to users without an explicit role).

CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");
CREATE INDEX "roles_is_admin_idx" ON "roles"("is_admin");

ALTER TABLE "profiles" ADD COLUMN "role_id" TEXT;

ALTER TABLE "workspace_settings" ADD COLUMN "default_role_id" TEXT;

ALTER TABLE "profiles" ADD CONSTRAINT "profiles_role_id_fkey"
    FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_default_role_id_fkey"
    FOREIGN KEY ("default_role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed the fixed Admin role (bypasses all permission checks).
INSERT INTO "roles" ("id", "name", "permissions", "is_admin", "created_at", "updated_at")
VALUES ('00000000-0000-0000-0000-000000000001', 'Admin', '[]', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Migration: every existing user becomes Admin.
UPDATE "profiles" SET "role_id" = '00000000-0000-0000-0000-000000000001' WHERE "role_id" IS NULL;
