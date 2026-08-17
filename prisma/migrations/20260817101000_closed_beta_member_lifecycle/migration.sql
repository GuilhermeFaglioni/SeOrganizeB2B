ALTER TABLE "profiles"
ADD COLUMN "removed_at" TIMESTAMP(3);

CREATE INDEX "profiles_removed_at_idx" ON "profiles"("removed_at");
