ALTER TABLE "ai_provider_connections"
  ADD COLUMN "ownership_mode" TEXT NOT NULL DEFAULT 'byok';

ALTER TABLE "ai_provider_connections"
  ADD CONSTRAINT "ai_provider_connections_ownership_mode_check"
  CHECK ("ownership_mode" IN ('managed', 'byok'));

ALTER TABLE "ai_studio_managed_cycles"
  ADD COLUMN "switch_history" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "ai_studio_managed_cycles"
  DROP CONSTRAINT "ai_studio_managed_cycles_status_check";

ALTER TABLE "ai_studio_managed_cycles"
  ADD CONSTRAINT "ai_studio_managed_cycles_status_check"
  CHECK ("status" IN ('active', 'saved', 'expired', 'exhausted', 'switched'));
