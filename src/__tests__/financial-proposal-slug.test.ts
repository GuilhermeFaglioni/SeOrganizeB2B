import { describe, expect, it } from "vitest";
import { makeProposalPublicSlug, slugifyProposalTitle } from "../lib/financial/proposal-slug";

describe("proposal public slug", () => {
  it("turns a proposal title into a readable URL segment", () => {
    expect(slugifyProposalTitle("Implantação & Estratégia — 2026")).toBe(
      "implantacao-estrategia-2026"
    );
  });

  it("keeps the slug readable while adding a non-guessable suffix", () => {
    const slug = makeProposalPublicSlug("Proposta Teste", "a1b2c3d4e5f6a7b8");
    expect(slug).toBe("proposta-teste-a1b2c3d4e5f6a7b8");
    expect(slug).toMatch(/^[a-z0-9-]+-[a-f0-9]{16}$/);
  });

  it("falls back to proposta for titles without URL-safe characters", () => {
    expect(slugifyProposalTitle("!!!")).toBe("proposta");
  });
});
