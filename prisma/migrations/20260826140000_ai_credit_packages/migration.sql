CREATE TABLE "ai_credit_packages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stripe_price_id" TEXT NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "credit_quantity" INTEGER NOT NULL,
    "max_purchases_per_month" INTEGER,
    "max_credits_per_month" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ai_credit_packages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ai_credit_packages_values_check" CHECK ("price_cents" > 0 AND "credit_quantity" > 0 AND ("max_purchases_per_month" IS NULL OR "max_purchases_per_month" > 0) AND ("max_credits_per_month" IS NULL OR "max_credits_per_month" > 0))
);
CREATE UNIQUE INDEX "ai_credit_packages_stripe_price_id_key" ON "ai_credit_packages"("stripe_price_id");
CREATE INDEX "ai_credit_packages_is_active_idx" ON "ai_credit_packages"("is_active");

CREATE TABLE "ai_credit_purchases" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "purchaser_id" TEXT NOT NULL,
    "package_id" TEXT NOT NULL,
    "stripe_checkout_session_id" TEXT NOT NULL,
    "stripe_payment_intent_id" TEXT,
    "amount_cents" INTEGER NOT NULL,
    "credit_quantity" INTEGER NOT NULL,
    "refunded_amount_cents" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ai_credit_purchases_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ai_credit_purchases_values_check" CHECK ("amount_cents" > 0 AND "credit_quantity" > 0 AND "refunded_amount_cents" >= 0 AND "refunded_amount_cents" <= "amount_cents")
);
CREATE UNIQUE INDEX "ai_credit_purchases_stripe_checkout_session_id_key" ON "ai_credit_purchases"("stripe_checkout_session_id");
CREATE UNIQUE INDEX "ai_credit_purchases_stripe_payment_intent_id_key" ON "ai_credit_purchases"("stripe_payment_intent_id");
CREATE INDEX "ai_credit_purchases_tenant_id_created_at_idx" ON "ai_credit_purchases"("tenant_id", "created_at");
CREATE INDEX "ai_credit_purchases_tenant_id_status_created_at_idx" ON "ai_credit_purchases"("tenant_id", "status", "created_at");
ALTER TABLE "ai_credit_purchases" ADD CONSTRAINT "ai_credit_purchases_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_credit_purchases" ADD CONSTRAINT "ai_credit_purchases_purchaser_id_fkey" FOREIGN KEY ("purchaser_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ai_credit_purchases" ADD CONSTRAINT "ai_credit_purchases_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "ai_credit_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ai_credit_purchases" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_select" ON "ai_credit_purchases" FOR SELECT USING (tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000'));
CREATE POLICY "tenant_isolation_insert" ON "ai_credit_purchases" FOR INSERT WITH CHECK (tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000'));
CREATE POLICY "tenant_isolation_update" ON "ai_credit_purchases" FOR UPDATE USING (tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000'));
CREATE POLICY "tenant_isolation_delete" ON "ai_credit_purchases" FOR DELETE USING (tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), '00000000-0000-0000-0000-000000000000'));
