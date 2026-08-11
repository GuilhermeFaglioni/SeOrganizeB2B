import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const schema = readFileSync(resolve(__dirname, "../schema.prisma"), "utf-8");
const migration = readFileSync(
  resolve(__dirname, "../migrations/20260811151935_add_workspaces/migration.sql"),
  "utf-8"
);
const deletedAtMigration = readFileSync(
  resolve(
    __dirname,
    "../migrations/20260811175650_add_workspace_deleted_at/migration.sql"
  ),
  "utf-8"
);

describe("workspaces schema contract", () => {
  it("defines a unique slug on the Workspace model", () => {
    const workspace = schema.match(/model Workspace \{([\s\S]*?)\n\}/)?.[1];

    expect(workspace).toBeDefined();
    expect(workspace).toContain("slug              String    @unique");
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "workspaces_slug_key" ON "workspaces"("slug");'
    );
  });

  it("defaults status to active", () => {
    const workspace = schema.match(/model Workspace \{([\s\S]*?)\n\}/)?.[1];
    const status = workspace?.match(/^\s*status\s+String\s+([^\n]*)/m)?.[1];

    expect(status).toContain('@default("active")');
    expect(migration).toContain('"status" TEXT NOT NULL DEFAULT \'active\'');
  });

  it("maps camelCase fields to snake_case columns", () => {
    const workspace = schema.match(/model Workspace \{([\s\S]*?)\n\}/)?.[1];

    expect(workspace).toContain('logoUrl           String?   @map("logo_url")');
    expect(workspace).toContain(
      'companyName       String?   @map("company_name")'
    );
    expect(workspace).toContain(
      'defaultRoleId     String?   @map("default_role_id")'
    );
    expect(workspace).toContain(
      'stripeCustomerId  String?   @map("stripe_customer_id")'
    );
    expect(workspace).toContain('planId            String?   @map("plan_id")');
    expect(workspace).toContain(
      'gracePeriodEndsAt DateTime? @map("grace_period_ends_at")'
    );
    expect(workspace).toContain('cancelledAt       DateTime? @map("cancelled_at")');
  });

  it("supports soft delete via a nullable deletedAt column", () => {
    const workspace = schema.match(/model Workspace \{([\s\S]*?)\n\}/)?.[1];

    expect(workspace).toContain('deletedAt         DateTime? @map("deleted_at")');
    expect(deletedAtMigration).toContain('"deleted_at" TIMESTAMP(3)');
  });

  it("maps the model to the workspaces table", () => {
    const workspace = schema.match(/model Workspace \{([\s\S]*?)\n\}/)?.[1];

    expect(workspace).toContain('@@map("workspaces")');
    expect(migration).toContain('CREATE TABLE "workspaces"');
  });
});
