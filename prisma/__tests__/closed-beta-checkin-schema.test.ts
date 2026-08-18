import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const schema = readFileSync(resolve(__dirname, "../schema.prisma"), "utf-8");
const migration = readFileSync(
  resolve(__dirname, "../migrations/20260818090000_closed_beta_checkin/migration.sql"),
  "utf-8",
);

describe("Closed Beta check-in schema contract", () => {
  it("defines editions with a publish/close lifecycle", () => {
    const edition = schema.match(
      /model ClosedBetaCheckinEdition \{([\s\S]*?)\n\}/,
    )?.[1];

    expect(edition).toBeDefined();
    expect(edition).toContain('@default("draft")');
    expect(edition).toContain('@map("is_mandatory")');
    expect(edition).toContain('@map("opens_at")');
    expect(edition).toContain('@map("closes_at")');
    expect(edition).toContain("isMandatory");
    expect(edition).toContain("opensAt");
    expect(edition).toContain("closesAt");
    expect(migration).toContain('CREATE TABLE "closed_beta_checkin_editions"');
  });

  it("stores question snapshots with type, options and ordering", () => {
    const question = schema.match(
      /model ClosedBetaCheckinQuestion \{([\s\S]*?)\n\}/,
    )?.[1];

    expect(question).toBeDefined();
    expect(question).toContain('@map("edition_id")');
    expect(question).toContain("type                 String");
    expect(question).toContain("options              Json?");
    expect(question).toContain("position             Int");
    expect(question).toContain('@map("is_suggestion_question")');
    expect(question).toContain("isSuggestionQuestion");
    expect(question).toContain("onDelete: Cascade");
    expect(migration).toContain('CREATE TABLE "closed_beta_checkin_questions"');
  });

  it("keeps one response per member per edition and flags the completing one", () => {
    const response = schema.match(
      /model ClosedBetaCheckinResponse \{([\s\S]*?)\n\}/,
    )?.[1];

    expect(response).toBeDefined();
    expect(response).toContain('@map("workspace_id")');
    expect(response).toContain('@map("profile_id")');
    expect(response).toContain("answers     Json");
    expect(response).toContain('@map("is_primary")');
    expect(response).toContain("@@unique([editionId, profileId])");
    expect(migration).toContain('CREATE TABLE "closed_beta_checkin_responses"');
    expect(migration).toContain(
      '"closed_beta_checkin_responses_edition_id_profile_id_key"',
    );
  });

  it("stores per-workspace completion and exemption state", () => {
    const state = schema.match(
      /model ClosedBetaCheckinWorkspaceState \{([\s\S]*?)\n\}/,
    )?.[1];

    expect(state).toBeDefined();
    expect(state).toContain('@default("pending")');
    expect(state).toContain("completedByProfileId");
    expect(state).toContain('@map("completed_by_profile_id")');
    expect(state).toContain("exemptionReason");
    expect(state).toContain('@map("exemption_reason")');
    expect(state).toContain("exemptionExpiresAt");
    expect(state).toContain('@map("exemption_expires_at")');
    expect(state).toContain("@@unique([editionId, workspaceId])");
    expect(migration).toContain('CREATE TABLE "closed_beta_checkin_workspace_states"');
    expect(migration).toContain(
      '"closed_beta_checkin_workspace_states_edition_id_workspace_id_key"',
    );
  });

  it("enforces a single published mandatory edition", () => {
    expect(migration).toContain(
      '"closed_beta_checkin_editions_one_published_mandatory"',
    );
    expect(migration).toContain("WHERE is_mandatory = true AND status = 'published'");
  });

  it("wires check-in relations to Workspace and Profile", () => {
    const workspace = schema.match(/model Workspace \{([\s\S]*?)\n\}/)?.[1];
    const profile = schema.match(/model Profile \{([\s\S]*?)\n\}/)?.[1];

    expect(workspace).toContain("checkinResponses");
    expect(workspace).toContain("checkinWorkspaceStates");
    expect(profile).toContain("checkinResponses");
    expect(profile).toContain('@relation("ClosedBetaCheckinCompleter")');
  });
});
