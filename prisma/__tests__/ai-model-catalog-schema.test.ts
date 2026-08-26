import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const schema = readFileSync(resolve(__dirname, "../schema.prisma"), "utf8");
const migration = readFileSync(
  resolve(__dirname, "../migrations/20260825123000_ai_model_catalog/migration.sql"),
  "utf8",
);

describe("AI model catalog schema contract", () => {
  it("stores versioned ownership and pricing configuration", () => {
    const model = schema.match(/model AiModelCatalogEntry \{([\s\S]*?)\n\}/)?.[1];
    expect(model).toBeDefined();
    expect(model).toContain("ownershipMode");
    expect(model).toContain("inputCostMicros");
    expect(model).toContain("creditCostPerCycle");
    expect(model).toContain("version");
    expect(model).toContain("effectiveFrom");
    expect(model).toContain('@@unique([provider, model, version])');
  });

  it("constrains ownership mode and non-negative pricing", () => {
    expect(migration).toContain("ownership_mode_check");
    expect(migration).toContain("ownership_mode\" IN ('managed', 'byok')");
    expect(migration).toContain("costs_check");
    expect(migration).toContain('input_cost_micros" >= 0');
  });

  it("makes provider connection ownership explicit and records cycle switches", () => {
    const fullMigration = readFileSync(
      resolve(__dirname, "../migrations/20260826120000_ai_provider_ownership_and_switches/migration.sql"),
      "utf8",
    );
    expect(schema).toContain('ownershipMode   String    @default("byok") @map("ownership_mode")');
    expect(schema).toContain('switchHistory         Json     @default("[]") @map("switch_history")');
    expect(fullMigration).toContain("ownership_mode_check");
    expect(fullMigration).toContain("switch_history");
    expect(fullMigration).toContain("'switched'");
  });
});
