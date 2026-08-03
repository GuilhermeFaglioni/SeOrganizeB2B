import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const schema = readFileSync(resolve(__dirname, "../schema.prisma"), "utf-8");
const migration = readFileSync(
  resolve(__dirname, "../migrations/20260803130000_add_roles/migration.sql"),
  "utf-8"
);

describe("roles schema contract", () => {
  it("maps Prisma Role.isAdmin to the migrated snake_case column", () => {
    const role = schema.match(/model Role \{([\s\S]*?)\n\}/)?.[1];
    const isAdmin = role?.match(/^\s*isAdmin\s+Boolean\s+([^\n]*)/m)?.[1];

    expect(isAdmin).toContain('@map("is_admin")');
    expect(migration).toContain('"is_admin" BOOLEAN NOT NULL DEFAULT false');
  });
});
