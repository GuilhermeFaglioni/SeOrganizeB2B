import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const root = resolve(__dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const exists = (path: string) => existsSync(resolve(root, path));

describe("proposals UI", () => {
  it("adds a Propostas tab to the financial section", () => {
    const tabs = read("src/components/financial/financial-tabs.tsx");
    expect(tabs).toContain('href: "/financial/proposals"');
    expect(tabs).toContain('labelKey: "proposals"');
  });

  it("keeps the proposals routes present", () => {
    for (const page of [
      "src/app/(authenticated)/financial/proposals/page.tsx",
      "src/app/(authenticated)/financial/proposals/new/page.tsx",
      "src/app/(authenticated)/financial/proposals/[proposalId]/page.tsx",
      "src/app/(authenticated)/financial/proposals/[proposalId]/edit/page.tsx",
      "src/app/(authenticated)/financial/proposals/templates/page.tsx",
      "src/app/(authenticated)/financial/proposals/templates/new/page.tsx",
      "src/app/(authenticated)/financial/proposals/templates/[templateId]/page.tsx",
    ]) {
      expect(exists(page), page).toBe(true);
    }
  });

  it("exposes a public tokenized route", () => {
    expect(exists("src/app/p/[token]/page.tsx")).toBe(true);
    const source = read("src/app/p/[token]/page.tsx");
    expect(source).toContain("getProposalPublic");
    expect(source).toContain("PublicProposalView");
  });

  it("list renders proposals with status badge and actions", () => {
    const list = read("src/components/financial/proposals/proposal-list.tsx");
    expect(list).toContain("useProposals");
    expect(list).toContain("ProposalStatusBadge");
    expect(list).toContain("Pagination");
    expect(list).toContain('href="/financial/proposals/templates"');
  });

  it("form links to a template and client, and fills variables", () => {
    const form = read("src/components/financial/proposals/proposal-form.tsx");
    expect(form).toContain("useProposalTemplates");
    expect(form).toContain("useClients");
    expect(form).toContain("detectVariables");
    expect(form).toContain("/api/proposal-templates/preview");
  });

  it("template editor detects variables and previews server-side", () => {
    const editor = read("src/components/financial/proposals/template-editor.tsx");
    expect(editor).toContain("detectVariables");
    expect(editor).toContain("/api/proposal-templates/preview");
  });

  it("public view renders the snapshot and accept form", () => {
    const view = read("src/components/financial/proposals/public-proposal.tsx");
    expect(view).toContain("dangerouslySetInnerHTML");
    expect(view).toContain("/api/p/");
    expect(view).toContain("acceptedBy");
  });
});
