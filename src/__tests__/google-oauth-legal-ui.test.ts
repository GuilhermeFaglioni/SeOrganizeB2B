import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const root = resolve(__dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Google OAuth legal surface", () => {
  it("keeps the public legal routes available without authentication", () => {
    for (const route of [
      "src/app/(marketing)/privacy/page.tsx",
      "src/app/(marketing)/terms/page.tsx",
      "src/app/(marketing)/contact/page.tsx",
    ]) {
      expect(existsSync(resolve(root, route)), route).toBe(true);
    }
  });

  it("links legal pages from marketing and login surfaces", () => {
    expect(read("src/app/(marketing)/layout.tsx")).toContain('href="/privacy"');
    expect(read("src/app/(marketing)/layout.tsx")).toContain('href="/terms"');
    expect(read("src/app/login/page.tsx")).toContain('href="/privacy"');
    expect(read("src/app/login/page.tsx")).toContain('href="/terms"');
  });

  it("publishes the official controller and Google data disclosures", () => {
    const legal = read("src/components/marketing/legal-page.tsx");
    const messages = read("messages/pt-BR.json");
    expect(legal).not.toContain("placeholderNotice");
    expect(messages).not.toContain("TODO_");
    expect(messages).toContain("55.823.385 GUILHERME COSTA BARBOSA FAGLIONI");
    expect(messages).toContain("guilhermefaglioni.contato@gmail.com");
    expect(messages).toContain("Google Calendar");
  });

  it("publishes the AI Studio disclosures in both public legal documents", () => {
    const legal = read("src/components/marketing/legal-page.tsx");
    const pt = JSON.parse(read("messages/pt-BR.json")) as {
      legal: { privacy: { sections: Record<string, { title: string; body: string }> }; terms: { sections: Record<string, { title: string; body: string }> } };
    };
    const en = JSON.parse(read("messages/en.json")) as typeof pt;
    const requiredPrivacySections = [
      "aiStudioProviders",
      "aiStudioProcessing",
      "aiStudioRetention",
      "aiStudioTelemetry",
      "aiStudioCosts",
    ];
    const requiredTermsSections = ["aiStudioUse", "aiStudioProviderAuth", "aiStudioCosts"];

    for (const section of requiredPrivacySections) {
      expect(legal).toContain(`"${section}"`);
      expect(pt.legal.privacy.sections[section]).toBeTruthy();
      expect(en.legal.privacy.sections[section]).toBeTruthy();
    }

    for (const section of requiredTermsSections) {
      expect(legal).toContain(`"${section}"`);
      expect(pt.legal.terms.sections[section]).toBeTruthy();
      expect(en.legal.terms.sections[section]).toBeTruthy();
    }

    const disclosures = JSON.stringify({ pt, en });
    for (const disclosure of [
      "OpenAI",
      "Anthropic",
      "API Key",
      "OAuth",
      "30 minutos",
      "90 dias",
      "empresa",
      "company",
      "provider",
      "diretriz da empresa",
      "session summary",
    ]) {
      expect(disclosures).toContain(disclosure);
    }

    for (const section of requiredPrivacySections) {
      const ptSection = pt.legal.privacy.sections[section];
      const enSection = en.legal.privacy.sections[section];
      expect(`${ptSection.title} ${ptSection.body}`).not.toContain("workspace");
      expect(`${enSection.title} ${enSection.body}`).not.toContain("workspace");
    }
    for (const section of requiredTermsSections) {
      const ptSection = pt.legal.terms.sections[section];
      const enSection = en.legal.terms.sections[section];
      expect(`${ptSection.title} ${ptSection.body}`).not.toContain("workspace");
      expect(`${enSection.title} ${enSection.body}`).not.toContain("workspace");
    }
  });
});
