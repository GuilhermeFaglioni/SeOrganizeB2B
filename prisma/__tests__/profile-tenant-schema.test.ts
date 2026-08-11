import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const schema = readFileSync(resolve(__dirname, "../schema.prisma"), "utf-8");
const migration = readFileSync(
  resolve(__dirname, "../migrations/20260811153123_add_profile_tenant/migration.sql"),
  "utf-8"
);

describe("profile tenant schema contract", () => {
  it("defines a required tenantId on the Profile model mapped to tenant_id", () => {
    const profile = schema.match(/model Profile \{([\s\S]*?)\n\}/)?.[1];

    expect(profile).toBeDefined();
    expect(profile).toContain('tenantId  String   @map("tenant_id")');
  });

  it("wires Profile to Workspace as tenant with an index on tenantId", () => {
    const profile = schema.match(/model Profile \{([\s\S]*?)\n\}/)?.[1];

    expect(profile).toContain(
      "tenant Workspace @relation(fields: [tenantId], references: [id])"
    );
    expect(profile).toContain("@@index([tenantId])");
    expect(migration).toContain(
      'CREATE INDEX "profiles_tenant_id_idx" ON "profiles"("tenant_id")'
    );
    expect(migration).toContain(
      'FOREIGN KEY ("tenant_id") REFERENCES "workspaces"("id")'
    );
  });

  it("adds the inverse profiles relation to the Workspace model", () => {
    const workspace = schema.match(/model Workspace \{([\s\S]*?)\n\}/)?.[1];

    expect(workspace).toContain("profiles Profile[]");
  });

  it("backfills existing profiles to a default workspace", () => {
    expect(migration).toContain(
      "'00000000-0000-0000-0000-000000000001'"
    );
    expect(migration).toContain(
      'UPDATE "profiles" SET "tenant_id" = \'00000000-0000-0000-0000-000000000001\' WHERE "tenant_id" IS NULL'
    );
    expect(migration).toContain('ALTER COLUMN "tenant_id" SET NOT NULL');
  });
});
