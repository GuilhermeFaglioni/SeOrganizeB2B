-- T-008: migrate workspace_settings into workspaces and tenant-scope roles.
-- 1. Ensure the default workspace exists (idempotent; T-004 may already have created it).
INSERT INTO "workspaces" ("id", "name", "slug", "status", "created_at", "updated_at")
VALUES ('00000000-0000-0000-0000-000000000001', 'Default', 'default', 'active', now(), now())
ON CONFLICT ("id") DO NOTHING;

-- 2. Backfill roles.tenant_id for every role left NULL by T-005.
UPDATE "roles" SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;

-- 3. Copy workspace_settings data (companyName/logoUrl/defaultRoleId) into the
--    default workspace row before dropping the table.
UPDATE "workspaces" AS w
SET
    "company_name" = ws."company_name",
    "logo_url" = ws."logo_url",
    "default_role_id" = ws."default_role_id",
    "updated_at" = now()
FROM "workspace_settings" AS ws
WHERE w."id" = '00000000-0000-0000-0000-000000000001';

-- DropForeignKey
ALTER TABLE "roles" DROP CONSTRAINT "roles_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "workspace_settings" DROP CONSTRAINT "workspace_settings_default_role_id_fkey";

-- DropIndex
DROP INDEX "roles_name_key";

-- AlterTable
ALTER TABLE "roles" ALTER COLUMN "tenant_id" SET NOT NULL;

-- DropTable
DROP TABLE "workspace_settings";

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_tenant_id_key" ON "roles"("name", "tenant_id");

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
