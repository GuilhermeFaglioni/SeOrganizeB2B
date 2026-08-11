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
    const refs = Array.from(createdByMatches, (match) => match[1]);

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

  it("creates a Starter plan with the expected modules and isDefault", () => {
    const seedSource = readFileSync(
      resolve(__dirname, "../seed.ts"),
      "utf-8"
    );

    expect(seedSource).toContain("prisma.plan.findFirst");
    expect(seedSource).toContain('where: { name: "Starter" }');
    expect(seedSource).toContain('name: "Starter"');

    const starter = seedSource.match(
      /name: "Starter"[\s\S]*?allowedModules: \[([^\]]*)\]/
    );

    expect(starter).not.toBeNull();
    expect(starter![1]).toContain('"tasks"');
    expect(starter![1]).toContain('"projects"');
    expect(starter![1]).toContain('"calendar"');
    expect(starter![1]).toContain('"documents"');
    expect(seedSource).toContain("isDefault: true");
    expect(seedSource).toContain("isActive: true");
  });

  it("creates Starter plan limits for users, tasks, projects, and contracts", () => {
    const seedSource = readFileSync(
      resolve(__dirname, "../seed.ts"),
      "utf-8"
    );

    expect(seedSource).toContain("prisma.planLimit.findFirst");
    expect(seedSource).toContain("prisma.planLimit.create");

    expect(seedSource).toContain('{ resource: "users", limit: 5, behavior: "hard" }');
    expect(seedSource).toContain(
      '{ resource: "tasks", limit: 100, behavior: "warning" }'
    );
    expect(seedSource).toContain(
      '{ resource: "projects", limit: 10, behavior: "hard" }'
    );
    expect(seedSource).toContain(
      '{ resource: "contracts", limit: 0, behavior: "hard" }'
    );
  });

  it("upserts the default workspace linked to the Starter plan", () => {
    const seedSource = readFileSync(
      resolve(__dirname, "../seed.ts"),
      "utf-8"
    );

    expect(seedSource).toContain("prisma.workspace.upsert");
    expect(seedSource).toContain("DEFAULT_WORKSPACE_ID");
    expect(seedSource).toContain('slug: "default"');
    expect(seedSource).toContain("planId: starterPlan.id");
  });

  it("associates profiles to the default workspace", () => {
    const seedSource = readFileSync(
      resolve(__dirname, "../seed.ts"),
      "utf-8"
    );

    expect(seedSource).toContain("prisma.profile.updateMany");
    expect(seedSource).toContain("data: { tenantId: defaultWorkspace.id }");

    const profileCreate = seedSource.match(
      /prisma\.profile\.create\([\s\S]*?tenantId: defaultWorkspace\.id/
    );
    expect(profileCreate).not.toBeNull();
  });

  it("creates Admin and Member roles scoped to the default workspace", () => {
    const seedSource = readFileSync(
      resolve(__dirname, "../seed.ts"),
      "utf-8"
    );

    expect(seedSource).toContain('name: "Admin"');
    expect(seedSource).toContain('name: "Member"');
    expect(seedSource).toContain("name_tenantId");
    expect(seedSource).toContain("tenantId: defaultWorkspace.id");
    expect(seedSource).toContain("isAdmin: true");
    expect(seedSource).toContain("isAdmin: false");
  });

  it("runs the seed inside withTenantBypass", () => {
    const seedSource = readFileSync(
      resolve(__dirname, "../seed.ts"),
      "utf-8"
    );

    expect(seedSource).toContain("withTenantBypass(main)");
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
