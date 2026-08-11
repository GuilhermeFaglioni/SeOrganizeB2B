import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const schema = readFileSync(resolve(__dirname, "../schema.prisma"), "utf-8");
const migration = readFileSync(
  resolve(__dirname, "../migrations/20260811154409_add_project_members/migration.sql"),
  "utf-8"
);

function block(modelName: string): string {
  const match = schema.match(new RegExp(`model ${modelName} \\{([\\s\\S]*?)\\n\\}`));
  expect(match, `model ${modelName} not found in schema`).not.toBeNull();
  return match![1].replace(/\s+/g, " ").trim();
}

describe("project members schema contract", () => {
  it("defines the ProjectMember model with a composite PK and member fields", () => {
    const projectMember = block("ProjectMember");

    expect(projectMember).toContain('projectId String @map("project_id")');
    expect(projectMember).toContain('profileId String @map("profile_id")');
    expect(projectMember).toContain(
      'autoAssignedByArea Boolean @default(false) @map("auto_assigned_by_area")'
    );
    expect(projectMember).toContain('joinedAt DateTime @default(now()) @map("joined_at")');
    expect(projectMember).toContain("@@id([projectId, profileId])");
    expect(projectMember).toContain("@@index([profileId])");
    expect(projectMember).toContain('@@map("project_members")');
  });

  it("maps the ProjectMember model to the project_members table", () => {
    expect(migration).toContain('CREATE TABLE "project_members"');
    expect(migration).toContain(
      'CONSTRAINT "project_members_pkey" PRIMARY KEY ("project_id","profile_id")'
    );
    expect(migration).toContain(
      'CREATE INDEX "project_members_profile_id_idx" ON "project_members"("profile_id")'
    );
  });

  it("wires ProjectMember FKs to Project and Profile with onDelete Cascade", () => {
    const projectMember = block("ProjectMember");

    expect(projectMember).toContain(
      "project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)"
    );
    expect(projectMember).toContain(
      "profile Profile @relation(fields: [profileId], references: [id], onDelete: Cascade)"
    );

    const project = block("Project");
    expect(project).toContain("projectMembers ProjectMember[]");

    const profile = block("Profile");
    expect(profile).toContain("projectMembers ProjectMember[]");

    expect(migration).toContain(
      'ADD CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE'
    );
    expect(migration).toContain(
      'ADD CONSTRAINT "project_members_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE'
    );
  });
});