/*
  Warnings:

  - Added the required column `tenant_id` to the `profiles` table without a default value. This is not possible if the table is not empty.

*/
-- Backfill: ensure a default workspace exists before linking profiles to one
INSERT INTO "workspaces" ("id", "name", "slug", "status", "created_at", "updated_at")
VALUES ('00000000-0000-0000-0000-000000000001', 'Default', 'default', 'active', now(), now())
ON CONFLICT ("id") DO NOTHING;

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "tenant_id" TEXT;

-- Backfill: assign all existing profiles to the default workspace
UPDATE "profiles" SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;

-- Make the column NOT NULL now that every row is backfilled
ALTER TABLE "profiles" ALTER COLUMN "tenant_id" SET NOT NULL;

-- CreateIndex
CREATE INDEX "profiles_tenant_id_idx" ON "profiles"("tenant_id");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
