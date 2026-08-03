import { describe, expect, it } from "vitest";
import {
  detectVariables,
  renderProposalHtml,
  sanitizeProposalHtml,
} from "../lib/financial/proposals";

const baseContext = {
  values: {} as Record<string, string>,
  items: [],
  companyName: "Acme LTDA",
  companyLogoUrl: null,
  locale: "pt-BR",
};

describe("proposal template engine", () => {
  it("detects variables, deduplicates, and flags system vs custom", () => {
    const variables = detectVariables(
      "<p>{{cliente.nome}}</p><p>{{cliente.nome}}</p><p>{{projeto}}</p>"
    );
    expect(variables).toEqual([
      { name: "cliente.nome", isSystem: true },
      { name: "projeto", isSystem: false },
    ]);
  });

  it("sanitizes templates by removing scripts and event handlers", () => {
    const clean = sanitizeProposalHtml(
      '<p onclick="alert(1)">Olá</p><script>alert("x")</script><img src="x" onerror="alert(1)" /><style>p{color:red}</style>'
    );
    expect(clean).not.toContain("<script");
    expect(clean).not.toContain("onclick");
    expect(clean).not.toContain("onerror");
    expect(clean).toContain("<p>Olá</p>");
    expect(clean).toContain("<style>");
  });

  it("substitutes system and custom variables with escaped values", () => {
    const html = renderProposalHtml(
      "<h1>{{cliente.nome}}</h1><p>{{observacao}}</p>",
      {
        ...baseContext,
        values: {
          "cliente.nome": "João <script>alert(1)</script>",
          observacao: "<b>detalhe</b>",
        },
      }
    );
    expect(html).toContain("João &lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;b&gt;detalhe&lt;/b&gt;");
  });

  it("renders the items table into {{itens}}", () => {
    const html = renderProposalHtml("<p>{{itens}}</p>", {
      ...baseContext,
      items: [
        { name: "Consultoria", quantity: "2", price: "100.00", position: 0 },
      ],
    });
    expect(html).toContain("<table");
    expect(html).toContain("Consultoria");
    expect(html).not.toContain("{{itens}}");
  });

  it("renders company name and logo", () => {
    const html = renderProposalHtml(
      "<p>{{empresa.nome}}</p>{{empresa.logo}}",
      { ...baseContext, companyLogoUrl: "https://x.com/logo.png" }
    );
    expect(html).toContain("Acme LTDA");
    expect(html).toContain('<img src="https://x.com/logo.png"');
  });

  it("removes leftover unfilled placeholders", () => {
    const html = renderProposalHtml("<p>{{nao_preenchida}}</p>", baseContext);
    expect(html).not.toContain("{{nao_preenchida}}");
  });
});
