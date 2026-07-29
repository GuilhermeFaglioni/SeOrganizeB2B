import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

describe("migration", () => {
  it("does NOT contain the default-columns trigger (conflicts with Prisma engine)", () => {
    const migrationSql = readFileSync(
      resolve(__dirname, "../migrations/0001_init/migration.sql"),
      "utf-8"
    );

    expect(migrationSql).not.toContain("create_default_columns");
    expect(migrationSql).not.toContain("on_project_created");
    expect(migrationSql).not.toContain("AFTER INSERT ON public.projects");
  });
});

describe("prisma seed", () => {
  it("creates a Profile row before any TeamArea or Project references it", () => {
    const seedSource = readFileSync(
      resolve(__dirname, "../seed.ts"),
      "utf-8"
    );

    const createdByMatches = seedSource.matchAll(
      /createdBy:\s*(\w+)/g
    );
    const refs = [...createdByMatches].map((m) => m[1]);

    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      expect(ref).toBe("seedUserId");
    }

    const profileCreate = seedSource.match(
      /prisma\.profile\.create\(/
    );

    expect(profileCreate).not.toBeNull();

    const profileCreateIndex = seedSource.search(/prisma\.profile\.create\(/);
    const firstTeamAreaIndex = seedSource.search(/prisma\.teamArea\.create/);
    const firstProjectIndex = seedSource.search(/prisma\.project\.create/);
    const firstTaskIndex = seedSource.search(/prisma\.task\.createMany/);

    expect(profileCreateIndex).toBeLessThan(firstTeamAreaIndex);
    expect(profileCreateIndex).toBeLessThan(firstProjectIndex);
    expect(profileCreateIndex).toBeLessThan(firstTaskIndex);

    const seedUserIdDecl = seedSource.match(
      /seedUserId\s*=\s*"([^"]+)"/
    );
    expect(seedUserIdDecl).not.toBeNull();
    expect(seedUserIdDecl![1]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });
});

describe("default-columns utility", () => {
  it("creates 3 default columns (To Do, In Progress, Done) via application code", () => {
    const defaultsSource = readFileSync(
      resolve(__dirname, "../../src/lib/defaults.ts"),
      "utf-8"
    );

    expect(defaultsSource).toContain("createDefaultColumns");
    expect(defaultsSource).toContain("To Do");
    expect(defaultsSource).toContain("In Progress");
    expect(defaultsSource).toContain("Done");
    expect(defaultsSource).toContain("prisma.projectColumn.create");
  });
});
