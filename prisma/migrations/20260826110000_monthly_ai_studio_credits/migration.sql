ALTER TABLE "plans" ADD COLUMN "monthly_ai_studio_credits" INTEGER;

ALTER TABLE "plans"
  ADD CONSTRAINT "plans_monthly_ai_studio_credits_check"
  CHECK ("monthly_ai_studio_credits" IS NULL OR "monthly_ai_studio_credits" >= 0);
