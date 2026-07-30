ALTER TABLE "project_columns"
ADD COLUMN "completes_tasks" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "tasks"
ADD COLUMN "recurrence_type" TEXT,
ADD COLUMN "recurrence_interval" INTEGER,
ADD COLUMN "recurrence_series_id" TEXT,
ADD COLUMN "recurrence_generated_at" TIMESTAMP(3);

UPDATE "project_columns"
SET "completes_tasks" = true
WHERE lower("name") IN (
  'done',
  'concluído',
  'concluida',
  'concluída',
  'concluido',
  'finalizado',
  'finalizada'
);

CREATE TABLE "activities" (
  "id" TEXT NOT NULL,
  "actor_id" TEXT,
  "task_id" TEXT,
  "type" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notifications" (
  "id" TEXT NOT NULL,
  "recipient_id" TEXT NOT NULL,
  "activity_id" TEXT NOT NULL,
  "read_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "comment_mentions" (
  "comment_id" TEXT NOT NULL,
  "profile_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "comment_mentions_pkey" PRIMARY KEY ("comment_id", "profile_id")
);

CREATE TABLE "saved_views" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "filters" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "saved_views_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notifications_recipient_id_activity_id_key"
ON "notifications"("recipient_id", "activity_id");
CREATE INDEX "notifications_recipient_id_read_at_created_at_idx"
ON "notifications"("recipient_id", "read_at", "created_at");
CREATE INDEX "activities_actor_id_created_at_idx"
ON "activities"("actor_id", "created_at");
CREATE INDEX "activities_task_id_created_at_idx"
ON "activities"("task_id", "created_at");
CREATE INDEX "activities_entity_type_entity_id_idx"
ON "activities"("entity_type", "entity_id");
CREATE INDEX "comment_mentions_profile_id_idx"
ON "comment_mentions"("profile_id");
CREATE UNIQUE INDEX "saved_views_user_id_scope_name_key"
ON "saved_views"("user_id", "scope", "name");
CREATE INDEX "saved_views_user_id_scope_idx"
ON "saved_views"("user_id", "scope");

ALTER TABLE "activities"
ADD CONSTRAINT "activities_actor_id_fkey"
FOREIGN KEY ("actor_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "activities"
ADD CONSTRAINT "activities_task_id_fkey"
FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notifications"
ADD CONSTRAINT "notifications_recipient_id_fkey"
FOREIGN KEY ("recipient_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications"
ADD CONSTRAINT "notifications_activity_id_fkey"
FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comment_mentions"
ADD CONSTRAINT "comment_mentions_comment_id_fkey"
FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comment_mentions"
ADD CONSTRAINT "comment_mentions_profile_id_fkey"
FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "saved_views"
ADD CONSTRAINT "saved_views_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
