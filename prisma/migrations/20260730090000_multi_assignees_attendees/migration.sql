-- Add event shape required for all-day and timezone-aware rendering.
ALTER TABLE "calendar_events"
ADD COLUMN "all_day" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "time_zone" TEXT;

-- Create many-to-many task assignments before removing the legacy scalar.
CREATE TABLE "task_assignees" (
    "task_id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "assigned_by" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_assignees_pkey" PRIMARY KEY ("task_id", "profile_id")
);

CREATE INDEX "task_assignees_profile_id_idx"
ON "task_assignees"("profile_id");

ALTER TABLE "task_assignees"
ADD CONSTRAINT "task_assignees_task_id_fkey"
FOREIGN KEY ("task_id") REFERENCES "tasks"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "task_assignees"
ADD CONSTRAINT "task_assignees_profile_id_fkey"
FOREIGN KEY ("profile_id") REFERENCES "profiles"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "task_assignees" ("task_id", "profile_id", "assigned_by")
SELECT "id", "assignee_id", "created_by"
FROM "tasks"
WHERE "assignee_id" IS NOT NULL
ON CONFLICT ("task_id", "profile_id") DO NOTHING;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "tasks" AS task
        WHERE task."assignee_id" IS NOT NULL
          AND NOT EXISTS (
              SELECT 1
              FROM "task_assignees" AS assignment
              WHERE assignment."task_id" = task."id"
                AND assignment."profile_id" = task."assignee_id"
          )
    ) THEN
        RAISE EXCEPTION 'Task assignee backfill validation failed';
    END IF;
END
$$;

ALTER TABLE "tasks" DROP CONSTRAINT "tasks_assignee_id_fkey";
DROP INDEX "tasks_assignee_id_idx";
ALTER TABLE "tasks" DROP COLUMN "assignee_id";

-- Persist internal and external event participants.
CREATE TABLE "calendar_event_attendees" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "profile_id" TEXT,
    "email" TEXT NOT NULL,
    "display_name" TEXT,
    "response_status" TEXT NOT NULL DEFAULT 'needsAction',
    "organizer" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_event_attendees_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "calendar_event_attendees_event_id_email_key"
ON "calendar_event_attendees"("event_id", "email");

CREATE INDEX "calendar_event_attendees_profile_id_idx"
ON "calendar_event_attendees"("profile_id");

ALTER TABLE "calendar_event_attendees"
ADD CONSTRAINT "calendar_event_attendees_event_id_fkey"
FOREIGN KEY ("event_id") REFERENCES "calendar_events"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "calendar_event_attendees"
ADD CONSTRAINT "calendar_event_attendees_profile_id_fkey"
FOREIGN KEY ("profile_id") REFERENCES "profiles"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
