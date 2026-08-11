import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const schema = readFileSync(resolve(__dirname, "../schema.prisma"), "utf-8");
const migration = readFileSync(
  resolve(__dirname, "../migrations/20260811153938_add_operational_tenant/migration.sql"),
  "utf-8"
);

const OPERATIONAL_MODELS = [
  "TeamArea",
  "TeamMemberArea",
  "Project",
  "ProjectColumn",
  "Task",
  "TaskAssignee",
  "Comment",
  "CommentMention",
  "Document",
  "CalendarAuth",
  "CalendarEvent",
  "CalendarEventAttendee",
  "Activity",
  "Notification",
  "PushSubscription",
  "SavedView",
  "Client",
  "Contract",
  "ContractItem",
  "ContractProject",
  "Installment",
  "ContractChange",
  "ContractAudit",
  "ProposalTemplate",
  "Proposal",
  "ProposalItem",
];

const OPERATIONAL_TABLES = [
  "team_areas",
  "team_member_areas",
  "projects",
  "project_columns",
  "tasks",
  "task_assignees",
  "comments",
  "comment_mentions",
  "documents",
  "calendar_auth",
  "calendar_events",
  "calendar_event_attendees",
  "activities",
  "notifications",
  "push_subscriptions",
  "saved_views",
  "clients",
  "contracts",
  "contract_items",
  "contract_projects",
  "installments",
  "contract_changes",
  "contract_audits",
  "proposal_templates",
  "proposals",
  "proposal_items",
];

function normalize(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function modelBlock(modelName: string): string {
  const match = schema.match(new RegExp(`model ${modelName} \\{([\\s\\S]*?)\\n\\}`));
  expect(match, `model ${modelName} not found in schema`).not.toBeNull();
  return normalize(match![1]);
}

describe("operational tenant schema contract", () => {
  it.each(OPERATIONAL_MODELS)(
    "defines a required tenantId on %s mapped to tenant_id with an index",
    (modelName) => {
      const block = modelBlock(modelName);

      expect(block).toContain('tenantId String @map("tenant_id")');
      expect(block).toContain(
        "tenant Workspace @relation(fields: [tenantId], references: [id])"
      );
      expect(block).toContain("@@index([tenantId])");
    }
  );

  it("adds the inverse relations to the Workspace model", () => {
    const workspace = normalize(
      schema.match(/model Workspace \{([\s\S]*?)\n\}/)?.[1] ?? ""
    );

    expect(workspace).toContain("teamAreas TeamArea[]");
    expect(workspace).toContain("projects Project[]");
    expect(workspace).toContain("tasks Task[]");
    expect(workspace).toContain("taskAssignees TaskAssignee[]");
    expect(workspace).toContain("contracts Contract[]");
    expect(workspace).toContain("proposals Proposal[]");
    expect(workspace).toContain("proposalItems ProposalItem[]");
  });

  it("backfills all 26 operational tables to the default workspace", () => {
    for (const table of OPERATIONAL_TABLES) {
      expect(migration).toContain(
        `UPDATE "${table}" SET "tenant_id" = '00000000-0000-0000-0000-000000000001' WHERE "tenant_id" IS NULL`
      );
      expect(migration).toContain(
        `ALTER TABLE "${table}" ALTER COLUMN "tenant_id" SET NOT NULL`
      );
    }
  });

  it("adds the tenant FK and index for representative tables", () => {
    for (const table of ["team_areas", "tasks", "contracts", "proposals"]) {
      expect(migration).toContain(
        `CREATE INDEX "${table}_tenant_id_idx" ON "${table}"("tenant_id")`
      );
      expect(migration).toContain(
        `ALTER TABLE "${table}" ADD CONSTRAINT "${table}_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "workspaces"("id")`
      );
    }
  });

  it("joins tables keep their composite PK while gaining a plain tenant FK", () => {
    const taskAssignees = modelBlock("TaskAssignee");
    expect(taskAssignees).toContain("@@id([taskId, profileId])");
    expect(taskAssignees).toContain("@@index([tenantId])");

    const commentMentions = modelBlock("CommentMention");
    expect(commentMentions).toContain("@@id([commentId, profileId])");
    expect(commentMentions).toContain("@@index([tenantId])");

    const contractProjects = modelBlock("ContractProject");
    expect(contractProjects).toContain("@@id([contractId, projectId])");
    expect(contractProjects).toContain("@@index([tenantId])");
  });
});