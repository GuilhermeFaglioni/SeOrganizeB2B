-- Add the hashed manual workspace binding code.
ALTER TABLE "workspaces"
  ADD COLUMN "binding_code_hash" TEXT,
  ADD COLUMN "binding_code_updated_at" TIMESTAMP(3);

-- Normalize legacy identifiers so invite matching remains case-insensitive.
UPDATE "profiles" SET "email" = lower(btrim("email"));
UPDATE "invites" SET "email" = lower(btrim("email"));

-- Support lookup and expiry transitions for email-based pending invitations.
CREATE INDEX "invites_email_status_expires_at_idx"
  ON "invites" ("email", "status", "expires_at");

-- Persist binding-code rate limits across restarts and application instances.
CREATE TABLE "workspace_binding_attempts" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "window_started_at" TIMESTAMP(3) NOT NULL,
  "blocked_until" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "workspace_binding_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workspace_binding_attempts_user_id_key"
  ON "workspace_binding_attempts" ("user_id");
