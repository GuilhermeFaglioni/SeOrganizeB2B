import { describe, expect, it } from "vitest";
import { buildImmersiveProposalDocument } from "../components/financial/proposals/proposal-html-preview";
import { buildStudioPrompts } from "../lib/ai/studio-contract";

describe("immersive proposal preview", () => {
  it("keeps the proposal document in normal flow so the page can grow to its footer", () => {
    const document = buildImmersiveProposalDocument(
      '<div class="proposal"><header>Header</header><main>Content</main><footer>Footer</footer></div>',
      "proposal-test",
    );

    expect(document).toMatch(/html,\s*body,\s*body > \.proposal,\s*\.proposal\s*\{/);
    expect(document).toContain("overflow: visible !important");
    expect(document).toContain("position: static !important");
    expect(document).toContain("ResizeObserver");
  });
});

describe("AI Studio proposal layout contract", () => {
  it("requires generated headers and footers to stay in normal document flow", () => {
    const { systemPrompt } = buildStudioPrompts({
      locale: "pt-BR",
      directive: null,
      message: "Crie uma proposta comercial com header, conteúdo e footer.",
    });

    expect(systemPrompt).toContain("normal document flow");
    expect(systemPrompt).toContain("must not be fixed or sticky");
    expect(systemPrompt).toContain("must not create scroll containers");
  });
});
