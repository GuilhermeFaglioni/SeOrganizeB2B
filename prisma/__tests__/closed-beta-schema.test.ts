import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const schema = readFileSync(resolve(__dirname, "../schema.prisma"), "utf-8");
const migration = readFileSync(
  resolve(__dirname, "../migrations/20260817100000_closed_beta/migration.sql"),
  "utf-8",
);
const rateLimitMigration = readFileSync(
  resolve(__dirname, "../migrations/20260817102000_closed_beta_rate_limits/migration.sql"),
  "utf-8",
);

describe("Closed Beta schema contract", () => {
  it("marks plans as internal when needed", () => {
    const plan = schema.match(/model Plan \{([\s\S]*?)\n\}/)?.[1];

    expect(plan).toContain(
      'isInternal     Boolean  @default(false) @map("is_internal")',
    );
    expect(migration).toContain(
      'ADD COLUMN "is_internal" BOOLEAN NOT NULL DEFAULT false',
    );
  });

  it("defines the singleton campaign configuration", () => {
    const config = schema.match(/model ClosedBetaConfig \{([\s\S]*?)\n\}/)?.[1];

    expect(config).toBeDefined();
    expect(config).toContain('id                    String   @id @default("default")');
    expect(config).toContain("maxPrimaryWorkspaces  Int");
    expect(config).toContain("maxGuestsPerWorkspace Int");
    expect(config).toContain("planId                String   @unique");
    expect(migration).toContain('CREATE TABLE "closed_beta_configs"');
    expect(migration).toContain("'default'");
  });

  it("persists enrollment ownership separately from workspace roles", () => {
    const enrollment = schema.match(
      /model ClosedBetaEnrollment \{([\s\S]*?)\n\}/,
    )?.[1];

    expect(enrollment).toBeDefined();
    expect(enrollment).toContain('workspaceId    String    @unique @map("workspace_id")');
    expect(enrollment).toContain('ownerProfileId String    @unique @map("owner_profile_id")');
    expect(enrollment).toContain('owner     Profile   @relation("ClosedBetaOwner"');
    expect(migration).toContain('CREATE TABLE "closed_beta_enrollments"');
    expect(migration).toContain(
      'FOREIGN KEY ("owner_profile_id") REFERENCES "profiles"("id")',
    );
  });

  it("stores primary invitation tokens as hashes", () => {
    const invitation = schema.match(
      /model ClosedBetaInvitation \{([\s\S]*?)\n\}/,
    )?.[1];

    expect(invitation).toBeDefined();
    expect(invitation).toContain('tokenHash       String    @unique @map("token_hash")');
    expect(invitation).not.toContain("token          String");
    expect(migration).toContain('CREATE TABLE "closed_beta_invitations"');
  });

  it("provides a global audit event table", () => {
    const audit = schema.match(/model ClosedBetaAuditEvent \{([\s\S]*?)\n\}/)?.[1];

    expect(audit).toBeDefined();
    expect(audit).toContain("action      String");
    expect(audit).toContain('beforeValue Json?    @map("before_value")');
    expect(audit).toContain('afterValue  Json?    @map("after_value")');
    expect(migration).toContain('CREATE TABLE "closed_beta_audit_events"');
  });

  it("provides a global rate-limit table", () => {
    const rateLimit = schema.match(/model ClosedBetaRateLimit \{([\s\S]*?)\n\}/)?.[1];

    expect(rateLimit).toBeDefined();
    expect(rateLimit).toContain("attemptCount");
    expect(rateLimit).toContain("windowStartedAt");
    expect(rateLimitMigration).toContain('CREATE TABLE "closed_beta_rate_limits"');
  });
});
