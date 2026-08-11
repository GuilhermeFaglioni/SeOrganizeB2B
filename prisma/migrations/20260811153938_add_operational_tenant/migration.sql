/*
  Warnings:

  - Added the required column `tenant_id` to the `activities` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenant_id` to the `calendar_auth` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenant_id` to the `calendar_event_attendees` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenant_id` to the `calendar_events` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenant_id` to the `clients` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenant_id` to the `comment_mentions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenant_id` to the `comments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenant_id` to the `contract_audits` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenant_id` to the `contract_changes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenant_id` to the `contract_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenant_id` to the `contract_projects` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenant_id` to the `contracts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenant_id` to the `documents` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenant_id` to the `installments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenant_id` to the `notifications` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenant_id` to the `project_columns` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenant_id` to the `projects` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenant_id` to the `proposal_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenant_id` to the `proposal_templates` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenant_id` to the `proposals` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenant_id` to the `push_subscriptions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenant_id` to the `saved_views` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenant_id` to the `task_assignees` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenant_id` to the `tasks` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenant_id` to the `team_areas` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenant_id` to the `team_member_areas` table without a default value. This is not possible if the table is not empty.

*/

-- Backfill: ensure a default workspace exists before linking rows to one
INSERT INTO "workspaces" ("id", "name", "slug", "status", "created_at", "updated_at")
VALUES ('00000000-0000-0000-0000-000000000001', 'Default', 'default', 'active', now(), now())
ON CONFLICT ("id") DO NOTHING;

-- Add the tenant_id column as nullable so existing rows can be backfilled
ALTER TABLE "activities" ADD COLUMN     "tenant_id" TEXT;

ALTER TABLE "calendar_auth" ADD COLUMN     "tenant_id" TEXT;

ALTER TABLE "calendar_event_attendees" ADD COLUMN     "tenant_id" TEXT;

ALTER TABLE "calendar_events" ADD COLUMN     "tenant_id" TEXT;

ALTER TABLE "clients" ADD COLUMN     "tenant_id" TEXT;

ALTER TABLE "comment_mentions" ADD COLUMN     "tenant_id" TEXT;

ALTER TABLE "comments" ADD COLUMN     "tenant_id" TEXT;

ALTER TABLE "contract_audits" ADD COLUMN     "tenant_id" TEXT;

ALTER TABLE "contract_changes" ADD COLUMN     "tenant_id" TEXT;

ALTER TABLE "contract_items" ADD COLUMN     "tenant_id" TEXT;

ALTER TABLE "contract_projects" ADD COLUMN     "tenant_id" TEXT;

ALTER TABLE "contracts" ADD COLUMN     "tenant_id" TEXT;

ALTER TABLE "documents" ADD COLUMN     "tenant_id" TEXT;

ALTER TABLE "installments" ADD COLUMN     "tenant_id" TEXT;

ALTER TABLE "notifications" ADD COLUMN     "tenant_id" TEXT;

ALTER TABLE "project_columns" ADD COLUMN     "tenant_id" TEXT;

ALTER TABLE "projects" ADD COLUMN     "tenant_id" TEXT;

ALTER TABLE "proposal_items" ADD COLUMN     "tenant_id" TEXT;

ALTER TABLE "proposal_templates" ADD COLUMN     "tenant_id" TEXT;

ALTER TABLE "proposals" ADD COLUMN     "tenant_id" TEXT;

ALTER TABLE "push_subscriptions" ADD COLUMN     "tenant_id" TEXT;

ALTER TABLE "saved_views" ADD COLUMN     "tenant_id" TEXT;

ALTER TABLE "task_assignees" ADD COLUMN     "tenant_id" TEXT;

ALTER TABLE "tasks" ADD COLUMN     "tenant_id" TEXT;

ALTER TABLE "team_areas" ADD COLUMN     "tenant_id" TEXT;

ALTER TABLE "team_member_areas" ADD COLUMN     "tenant_id" TEXT;

-- Backfill: assign all existing rows to the default workspace
UPDATE "activities" SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;

UPDATE "calendar_auth" SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;

UPDATE "calendar_event_attendees" SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;

UPDATE "calendar_events" SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;

UPDATE "clients" SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;

UPDATE "comment_mentions" SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;

UPDATE "comments" SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;

UPDATE "contract_audits" SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;

UPDATE "contract_changes" SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;

UPDATE "contract_items" SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;

UPDATE "contract_projects" SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;

UPDATE "contracts" SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;

UPDATE "documents" SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;

UPDATE "installments" SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;

UPDATE "notifications" SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;

UPDATE "project_columns" SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;

UPDATE "projects" SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;

UPDATE "proposal_items" SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;

UPDATE "proposal_templates" SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;

UPDATE "proposals" SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;

UPDATE "push_subscriptions" SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;

UPDATE "saved_views" SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;

UPDATE "task_assignees" SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;

UPDATE "tasks" SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;

UPDATE "team_areas" SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;

UPDATE "team_member_areas" SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL;

-- Make the column NOT NULL now that every row is backfilled
ALTER TABLE "activities" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "calendar_auth" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "calendar_event_attendees" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "calendar_events" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "clients" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "comment_mentions" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "comments" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "contract_audits" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "contract_changes" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "contract_items" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "contract_projects" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "contracts" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "documents" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "installments" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "notifications" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "project_columns" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "projects" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "proposal_items" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "proposal_templates" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "proposals" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "push_subscriptions" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "saved_views" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "task_assignees" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "tasks" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "team_areas" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "team_member_areas" ALTER COLUMN "tenant_id" SET NOT NULL;

-- CreateIndex
CREATE INDEX "activities_tenant_id_idx" ON "activities"("tenant_id");

-- CreateIndex
CREATE INDEX "calendar_auth_tenant_id_idx" ON "calendar_auth"("tenant_id");

-- CreateIndex
CREATE INDEX "calendar_event_attendees_tenant_id_idx" ON "calendar_event_attendees"("tenant_id");

-- CreateIndex
CREATE INDEX "calendar_events_tenant_id_idx" ON "calendar_events"("tenant_id");

-- CreateIndex
CREATE INDEX "clients_tenant_id_idx" ON "clients"("tenant_id");

-- CreateIndex
CREATE INDEX "comment_mentions_tenant_id_idx" ON "comment_mentions"("tenant_id");

-- CreateIndex
CREATE INDEX "comments_tenant_id_idx" ON "comments"("tenant_id");

-- CreateIndex
CREATE INDEX "contract_audits_tenant_id_idx" ON "contract_audits"("tenant_id");

-- CreateIndex
CREATE INDEX "contract_changes_tenant_id_idx" ON "contract_changes"("tenant_id");

-- CreateIndex
CREATE INDEX "contract_items_tenant_id_idx" ON "contract_items"("tenant_id");

-- CreateIndex
CREATE INDEX "contract_projects_tenant_id_idx" ON "contract_projects"("tenant_id");

-- CreateIndex
CREATE INDEX "contracts_tenant_id_idx" ON "contracts"("tenant_id");

-- CreateIndex
CREATE INDEX "documents_tenant_id_idx" ON "documents"("tenant_id");

-- CreateIndex
CREATE INDEX "installments_tenant_id_idx" ON "installments"("tenant_id");

-- CreateIndex
CREATE INDEX "notifications_tenant_id_idx" ON "notifications"("tenant_id");

-- CreateIndex
CREATE INDEX "project_columns_tenant_id_idx" ON "project_columns"("tenant_id");

-- CreateIndex
CREATE INDEX "projects_tenant_id_idx" ON "projects"("tenant_id");

-- CreateIndex
CREATE INDEX "proposal_items_tenant_id_idx" ON "proposal_items"("tenant_id");

-- CreateIndex
CREATE INDEX "proposal_templates_tenant_id_idx" ON "proposal_templates"("tenant_id");

-- CreateIndex
CREATE INDEX "proposals_tenant_id_idx" ON "proposals"("tenant_id");

-- CreateIndex
CREATE INDEX "push_subscriptions_tenant_id_idx" ON "push_subscriptions"("tenant_id");

-- CreateIndex
CREATE INDEX "saved_views_tenant_id_idx" ON "saved_views"("tenant_id");

-- CreateIndex
CREATE INDEX "task_assignees_tenant_id_idx" ON "task_assignees"("tenant_id");

-- CreateIndex
CREATE INDEX "tasks_tenant_id_idx" ON "tasks"("tenant_id");

-- CreateIndex
CREATE INDEX "team_areas_tenant_id_idx" ON "team_areas"("tenant_id");

-- CreateIndex
CREATE INDEX "team_member_areas_tenant_id_idx" ON "team_member_areas"("tenant_id");

-- AddForeignKey
ALTER TABLE "team_areas" ADD CONSTRAINT "team_areas_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_member_areas" ADD CONSTRAINT "team_member_areas_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_columns" ADD CONSTRAINT "project_columns_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_mentions" ADD CONSTRAINT "comment_mentions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_auth" ADD CONSTRAINT "calendar_auth_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_event_attendees" ADD CONSTRAINT "calendar_event_attendees_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_items" ADD CONSTRAINT "contract_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_projects" ADD CONSTRAINT "contract_projects_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installments" ADD CONSTRAINT "installments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_changes" ADD CONSTRAINT "contract_changes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_audits" ADD CONSTRAINT "contract_audits_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_templates" ADD CONSTRAINT "proposal_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_items" ADD CONSTRAINT "proposal_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;