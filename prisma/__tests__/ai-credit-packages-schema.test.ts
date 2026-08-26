import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const schema = readFileSync(resolve(__dirname, "../schema.prisma"), "utf8");
const migration = readFileSync(resolve(__dirname, "../migrations/20260826140000_ai_credit_packages/migration.sql"), "utf8");

describe("AI credit package schema contract", () => {
  it("keeps package pricing and limits in a global catalog", () => {
    const model = schema.match(/model AiCreditPackage \{([\s\S]*?)\n\}/)?.[1];
    expect(model).toContain('stripePriceId       String   @unique @map("stripe_price_id")');
    expect(model).toContain('creditQuantity      Int      @map("credit_quantity")');
    expect(model).toContain('maxPurchasesPerMonth Int?    @map("max_purchases_per_month")');
    expect(model).toContain('maxCreditsPerMonth  Int?     @map("max_credits_per_month")');
  });

  it("keeps purchases tenant-scoped and checkout-idempotent", () => {
    const model = schema.match(/model AiCreditPurchase \{([\s\S]*?)\n\}/)?.[1];
    expect(model).toContain('stripeCheckoutSessionId String @unique @map("stripe_checkout_session_id")');
    expect(model).toContain('stripePaymentIntentId String?  @unique @map("stripe_payment_intent_id")');
    expect(migration).toContain('ALTER TABLE "ai_credit_purchases" ENABLE ROW LEVEL SECURITY;');
    expect(migration).toContain('CREATE UNIQUE INDEX "ai_credit_purchases_stripe_checkout_session_id_key"');
  });
});
