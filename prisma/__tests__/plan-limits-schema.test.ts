import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const schema = readFileSync(resolve(__dirname, "../schema.prisma"), "utf-8");
const migration = readFileSync(
  resolve(__dirname, "../migrations/20260811152855_add_plan_limits/migration.sql"),
  "utf-8"
);

describe("plan limits schema contract", () => {
  it("defines the PlanLimit model with per-plan resource limit fields", () => {
    const planLimit = schema.match(
      /model PlanLimit \{([\s\S]*?)\n\}/
    )?.[1];

    expect(planLimit).toBeDefined();
    expect(planLimit).toContain('planId    String   @map("plan_id")');
    expect(planLimit).toContain("resource  String");
    expect(planLimit).toContain("limit     Int");
    expect(planLimit).toContain("behavior  String");
    expect(planLimit).toContain('createdAt DateTime @default(now()) @map("created_at")');
    expect(planLimit).toContain('updatedAt DateTime @updatedAt @map("updated_at")');
  });

  it("maps the PlanLimit model to the plan_limits table with a planId index", () => {
    const planLimit = schema.match(
      /model PlanLimit \{([\s\S]*?)\n\}/
    )?.[1];

    expect(planLimit).toContain('@@map("plan_limits")');
    expect(planLimit).toContain("@@index([planId])");
    expect(migration).toContain('CREATE TABLE "plan_limits"');
    expect(migration).toContain(
      'CREATE INDEX "plan_limits_plan_id_idx" ON "plan_limits"("plan_id")'
    );
  });

  it("wires PlanLimit to Plan with onDelete Cascade", () => {
    const planLimit = schema.match(
      /model PlanLimit \{([\s\S]*?)\n\}/
    )?.[1];

    expect(planLimit).toContain(
      "plan Plan @relation(fields: [planId], references: [id], onDelete: Cascade)"
    );

    const plan = schema.match(/model Plan \{([\s\S]*?)\n\}/)?.[1];
    expect(plan).toContain("planLimits PlanLimit[]");

    expect(migration).toContain(
      'ADD CONSTRAINT "plan_limits_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE'
    );
  });
});