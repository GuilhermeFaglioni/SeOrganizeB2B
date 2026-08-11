import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const schema = readFileSync(resolve(__dirname, "../schema.prisma"), "utf-8");
const migration = readFileSync(
  resolve(__dirname, "../migrations/20260811152611_add_plans/migration.sql"),
  "utf-8"
);

describe("plans schema contract", () => {
  it("defines the Plan model with subscription fields", () => {
    const plan = schema.match(/model Plan \{([\s\S]*?)\n\}/)?.[1];

    expect(plan).toBeDefined();
    expect(plan).toContain('stripePriceId  String?  @map("stripe_price_id")');
    expect(plan).toContain('allowedModules Json     @default("[]")');
    expect(plan).toContain(
      'isDefault      Boolean  @default(false) @map("is_default")'
    );
    expect(plan).toContain('isActive       Boolean  @default(true) @map("is_active")');
  });

  it("maps the Plan model to the plans table", () => {
    const plan = schema.match(/model Plan \{([\s\S]*?)\n\}/)?.[1];

    expect(plan).toContain('@@map("plans")');
    expect(migration).toContain('CREATE TABLE "plans"');
  });

  it("wires an optional plan relation on Workspace with onDelete SetNull", () => {
    const workspace = schema.match(/model Workspace \{([\s\S]*?)\n\}/)?.[1];

    expect(workspace).toContain(
      "plan        Plan?   @relation(fields: [planId], references: [id], onDelete: SetNull)"
    );
    expect(migration).toContain(
      'ADD CONSTRAINT "workspaces_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE'
    );
  });
});
