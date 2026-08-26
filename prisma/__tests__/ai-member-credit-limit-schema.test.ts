import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("AI member credit limit schema", () => {
  it("defines a tenant-owned, non-negative monthly limit", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf8");
    expect(schema).toContain("model AiMemberCreditLimit");
    expect(schema).toContain("monthlyLimit Int");
    expect(schema).toContain("@@unique([tenantId, profileId])");
    const migration = readFileSync("prisma/migrations/20260826130000_ai_member_credit_limits/migration.sql", "utf8");
    expect(migration).toContain('"monthly_limit" >= 0');
    expect(migration).toContain("tenant_isolation_select");
  });
});
