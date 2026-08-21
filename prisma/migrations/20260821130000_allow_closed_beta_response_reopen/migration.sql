-- Preserve reset responses while allowing the member to submit a replacement.
ALTER TABLE "closed_beta_checkin_responses"
ADD COLUMN "is_current" BOOLEAN NOT NULL DEFAULT true;

DROP INDEX "closed_beta_checkin_responses_edition_id_profile_id_key";

CREATE UNIQUE INDEX "closed_beta_checkin_responses_current_edition_id_profile_id_key"
ON "closed_beta_checkin_responses"("edition_id", "profile_id")
WHERE "is_current" = true;

CREATE INDEX "closed_beta_checkin_responses_edition_id_profile_id_idx"
ON "closed_beta_checkin_responses"("edition_id", "profile_id");
