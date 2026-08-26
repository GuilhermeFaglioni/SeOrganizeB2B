CREATE TABLE "ai_model_catalog_entries" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "ownership_mode" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "vision" BOOLEAN NOT NULL DEFAULT false,
    "streaming" BOOLEAN NOT NULL DEFAULT false,
    "input_cost_micros" INTEGER NOT NULL,
    "output_cost_micros" INTEGER NOT NULL,
    "image_cost_micros" INTEGER NOT NULL DEFAULT 0,
    "credit_cost_per_cycle" INTEGER NOT NULL,
    "max_output_tokens" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "effective_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_model_catalog_entries_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ai_model_catalog_entries_ownership_mode_check" CHECK ("ownership_mode" IN ('managed', 'byok')),
    CONSTRAINT "ai_model_catalog_entries_costs_check" CHECK (
      "input_cost_micros" >= 0 AND "output_cost_micros" >= 0 AND "image_cost_micros" >= 0
      AND "credit_cost_per_cycle" >= 0 AND "max_output_tokens" > 0
      AND ("ownership_mode" <> 'managed' OR "credit_cost_per_cycle" > 0)
    )
);

CREATE UNIQUE INDEX "ai_model_catalog_entries_provider_model_version_key"
ON "ai_model_catalog_entries"("provider", "model", "version");
CREATE INDEX "ai_model_catalog_entries_provider_model_is_active_idx"
ON "ai_model_catalog_entries"("provider", "model", "is_active");
CREATE INDEX "ai_model_catalog_entries_effective_from_effective_to_idx"
ON "ai_model_catalog_entries"("effective_from", "effective_to");

ALTER TABLE "ai_model_catalog_entries" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "catalog_public_read" ON "ai_model_catalog_entries" FOR SELECT USING (true);
CREATE POLICY "super_admin_bypass" ON "ai_model_catalog_entries" FOR ALL USING (COALESCE(public.jwt_claim('super_admin')::boolean, false) = true);
