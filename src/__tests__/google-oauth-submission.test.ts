import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const root = resolve(__dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Google OAuth submission evidence", () => {
  it("documents the least-privilege scope justification and manual scenarios", () => {
    const checklist = read("docs/google-oauth-submission-checklist.md");
    expect(checklist).toContain("calendar.events.owned");
    expect(checklist).toContain("calendar.events");
    expect(checklist).toContain("Event deletion");
    expect(checklist).toContain("Technical Video Script");
    expect(checklist).toContain("OAuth client ID");
  });

  it("records the completed legal configuration and remaining submission gates", () => {
    const checklist = read("docs/google-oauth-submission-checklist.md");
    expect(checklist).toContain("Legal entity and CNPJ confirmed");
    expect(checklist).toContain("Retention and terms acceptance policy confirmed");
    expect(checklist).toContain("Search Console ownership verified");
  });
});
