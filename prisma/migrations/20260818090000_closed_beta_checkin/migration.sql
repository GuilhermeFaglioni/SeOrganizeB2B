-- Closed Beta weekly check-in: durable editions, question snapshots,
-- member responses and per-workspace completion/exemption state.

CREATE TABLE "closed_beta_checkin_editions" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "is_mandatory" BOOLEAN NOT NULL DEFAULT true,
    "opens_at" TIMESTAMP(3),
    "closes_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "closed_beta_checkin_editions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "closed_beta_checkin_questions" (
    "id" TEXT NOT NULL,
    "edition_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "options" JSONB,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "theme" TEXT,
    "is_suggestion_question" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "closed_beta_checkin_questions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "closed_beta_checkin_responses" (
    "id" TEXT NOT NULL,
    "edition_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "closed_beta_checkin_responses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "closed_beta_checkin_workspace_states" (
    "id" TEXT NOT NULL,
    "edition_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "completed_by_profile_id" TEXT,
    "completed_at" TIMESTAMP(3),
    "exemption_reason" TEXT,
    "exemption_expires_at" TIMESTAMP(3),
    "granted_by_user_id" TEXT,
    "granted_by_email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "closed_beta_checkin_workspace_states_pkey" PRIMARY KEY ("id")
);

-- At most one published mandatory edition can be the active weekly check-in.
CREATE UNIQUE INDEX "closed_beta_checkin_editions_one_published_mandatory"
ON "closed_beta_checkin_editions"("is_mandatory")
WHERE is_mandatory = true AND status = 'published';

CREATE UNIQUE INDEX "closed_beta_checkin_responses_edition_id_profile_id_key"
ON "closed_beta_checkin_responses"("edition_id", "profile_id");
CREATE UNIQUE INDEX "closed_beta_checkin_workspace_states_edition_id_workspace_id_key"
ON "closed_beta_checkin_workspace_states"("edition_id", "workspace_id");

CREATE INDEX "closed_beta_checkin_editions_status_idx"
ON "closed_beta_checkin_editions"("status");
CREATE INDEX "closed_beta_checkin_questions_edition_id_idx"
ON "closed_beta_checkin_questions"("edition_id");
CREATE INDEX "closed_beta_checkin_responses_edition_id_workspace_id_idx"
ON "closed_beta_checkin_responses"("edition_id", "workspace_id");
CREATE INDEX "closed_beta_checkin_responses_workspace_id_idx"
ON "closed_beta_checkin_responses"("workspace_id");
CREATE INDEX "closed_beta_checkin_responses_profile_id_idx"
ON "closed_beta_checkin_responses"("profile_id");
CREATE INDEX "closed_beta_checkin_workspace_states_workspace_id_idx"
ON "closed_beta_checkin_workspace_states"("workspace_id");
CREATE INDEX "closed_beta_checkin_workspace_states_status_idx"
ON "closed_beta_checkin_workspace_states"("status");

ALTER TABLE "closed_beta_checkin_questions"
ADD CONSTRAINT "closed_beta_checkin_questions_edition_id_fkey"
FOREIGN KEY ("edition_id") REFERENCES "closed_beta_checkin_editions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "closed_beta_checkin_responses"
ADD CONSTRAINT "closed_beta_checkin_responses_edition_id_fkey"
FOREIGN KEY ("edition_id") REFERENCES "closed_beta_checkin_editions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "closed_beta_checkin_responses"
ADD CONSTRAINT "closed_beta_checkin_responses_workspace_id_fkey"
FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "closed_beta_checkin_responses"
ADD CONSTRAINT "closed_beta_checkin_responses_profile_id_fkey"
FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "closed_beta_checkin_workspace_states"
ADD CONSTRAINT "closed_beta_checkin_workspace_states_edition_id_fkey"
FOREIGN KEY ("edition_id") REFERENCES "closed_beta_checkin_editions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "closed_beta_checkin_workspace_states"
ADD CONSTRAINT "closed_beta_checkin_workspace_states_workspace_id_fkey"
FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "closed_beta_checkin_workspace_states"
ADD CONSTRAINT "closed_beta_checkin_workspace_states_completed_by_profile_id_fkey"
FOREIGN KEY ("completed_by_profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
