import { describe, expect, it } from "vitest";
import {
  AI_STUDIO_PROMPT_BASE_VERSION,
  buildPromptSnapshot,
  buildStudioPrompts,
  compactSessionMessage,
  compareVariables,
  mergeSessionSummaries,
  parseStructuredOutput,
  validateSessionSummary,
  AI_STUDIO_MAX_SESSION_SUMMARY_LENGTH,
  validateCandidateContract,
} from "../lib/ai/studio-contract";

describe("AI Studio text contract", () => {
  it("builds a versioned prompt snapshot with the official variable catalog", () => {
    const snapshot = buildPromptSnapshot("pt-BR", "Use tom executivo.", 0);

    expect(snapshot.promptBaseVersion).toBe(AI_STUDIO_PROMPT_BASE_VERSION);
    expect(snapshot.directive).toBe("Use tom executivo.");
    expect(snapshot.variableCatalog.map((item) => item.name)).toContain("itens");
    expect(snapshot.variableCatalog.find((item) => item.name === "itens")?.semantics).toContain("renderer");
    expect(snapshot.publicShellRules.join(" ")).toContain("acceptance");
    expect(snapshot.htmlRules.join(" ")).toContain("scripts");
  });

  it("delimits the ephemeral session and excludes unrelated modules", () => {
    const { systemPrompt, userPrompt } = buildStudioPrompts({
      locale: "pt-BR",
      directive: null,
      message: "Quero uma proposta para consultoria.",
      recentMessages: [{ role: "user", content: "Use azul." }],
      sessionSummary: { focus: "Sessão nova.", decisions: [], pending: [], variables: [] },
    });

    expect(systemPrompt).toContain(AI_STUDIO_PROMPT_BASE_VERSION);
    expect(userPrompt).toContain("<ai-studio-ephemeral-context>");
    expect(userPrompt).toContain("<user-briefing>");
    expect(userPrompt).not.toContain("clientes cadastrados");
    expect(userPrompt).not.toContain("propostas cadastradas");
  });

  it("accepts the structured candidate only when custom variables are declared", () => {
    const candidate = validateCandidateContract({
      explanation: "Candidato inicial.",
      html: "<section><h1>{{proposta.titulo}}</h1><p>{{prazo.entrega}}</p></section>",
      suggestedName: "Consultoria executiva",
      customVariables: [{ name: "prazo.entrega", description: "Prazo combinado." }],
      sessionSummary: { focus: "Briefing convertido em candidato.", decisions: [], pending: [], variables: [] },
    });

    expect(candidate?.customVariables[0].name).toBe("prazo.entrega");
    expect(
      validateCandidateContract({
        explanation: "Candidato.",
        html: "<p>{{prazo.entrega}}</p>",
        suggestedName: "Template",
        customVariables: [],
        sessionSummary: { focus: "Resumo", decisions: [], pending: [], variables: [] },
      }),
    ).toBeNull();
  });

  it("parses fenced provider JSON and reports variable changes", () => {
    expect(parseStructuredOutput("```json\n{\"ok\":true}\n```")).toEqual({ ok: true });
    expect(compareVariables("<p>{{cliente.nome}}</p>", "<p>{{proposta.titulo}}</p>")).toEqual({
      added: ["proposta.titulo"],
      removed: ["cliente.nome"],
      preserved: [],
    });
  });

  it("carries the sanitized base HTML only for refinement sessions", () => {
    const { systemPrompt, userPrompt } = buildStudioPrompts({
      locale: "pt-BR",
      directive: null,
      message: "Deixe o layout mais enxuto.",
      baseHtml: "<section>{{itens}}</section>",
    });

    expect(userPrompt).toContain("<current-sanitized-html>");
    expect(userPrompt).toContain("<section>{{itens}}</section>");
    expect(systemPrompt).toContain("refine an existing");
    expect(systemPrompt).toContain("{{itens}}");

    const fresh = buildStudioPrompts({ locale: "pt-BR", directive: null, message: "Novo template." });
    expect(fresh.userPrompt).not.toContain("<current-sanitized-html>");
    expect(fresh.systemPrompt).toContain("first reusable");
  });

  it("reports removals and additions across the base and the candidate", () => {
    const before = "<p>{{cliente.nome}}</p><p>{{itens}}</p><p>{{prazo.entrega}}</p>";
    const after = "<p>{{cliente.nome}}</p><p>{{prazo.entrega}}</p><p>{{valor.frete}}</p>";
    expect(compareVariables(before, after)).toEqual({
      added: ["valor.frete"],
      removed: ["itens"],
      preserved: ["cliente.nome", "prazo.entrega"],
    });
  });

  it("scopes the session summary as informational context that cannot change HTML", () => {
    const { systemPrompt, userPrompt } = buildStudioPrompts({
      locale: "pt-BR",
      directive: null,
      message: "Continue a partir do resumo.",
      sessionSummary: { focus: "Decisões da sessão: paleta azul.", decisions: ["Paleta azul"], pending: [], variables: [] },
      recentMessages: [
        { role: "user", content: "Use azul." },
        { role: "assistant", content: "Paleta aplicada." },
      ],
    });

    expect(systemPrompt).toContain("never replaces the current HTML");
    expect(systemPrompt).toContain("focus, decisions, pending and variables arrays");
    expect(userPrompt).toContain('"focus":"Decisões da sessão: paleta azul."');
    expect(userPrompt).toContain("recent_messages:");
    expect(userPrompt).toContain("Use azul.");
  });

  it("limits direct prompt construction to the configured recent-message window", () => {
    const messages = Array.from({ length: 12 }, (_, index) => ({
      role: "user" as const,
      content: `turn-${index}`,
    }));
    const { userPrompt } = buildStudioPrompts({
      locale: "pt-BR",
      directive: null,
      message: "Continue.",
      recentMessages: messages,
    });

    expect(userPrompt).toContain("turn-11");
    expect(userPrompt).not.toContain("turn-0");
    expect(userPrompt).not.toContain("turn-3");
  });

  it("requires a real summary object and keeps long transcript messages provider-safe", () => {
    expect(validateSessionSummary("free-form summary")).toBeNull();
    expect(validateSessionSummary({
      focus: "Layout",
      decisions: ["Preservar itens"],
      pending: [],
      variables: ["itens"],
    })).toEqual({
      focus: "Layout",
      decisions: ["Preservar itens"],
      pending: [],
      variables: ["itens"],
    });

    const longMessage = "x".repeat(8_000);
    expect(compactSessionMessage(longMessage).length).toBeLessThanOrEqual(4_000);
  });

  it("bounds accumulated decisions when two individually valid summaries are merged", () => {
    const previous = validateSessionSummary({
      focus: "Focus anterior",
      decisions: Array.from({ length: 6 }, (_, index) => `previous-${index}-${"x".repeat(390)}`),
      pending: [],
      variables: [],
    });
    const next = validateSessionSummary({
      focus: "Focus atual",
      decisions: Array.from({ length: 6 }, (_, index) => `next-${index}-${"y".repeat(390)}`),
      pending: [],
      variables: [],
    });

    expect(previous).not.toBeNull();
    expect(next).not.toBeNull();
    if (!previous || !next) throw new Error("test fixtures must be valid");
    const merged = mergeSessionSummaries(previous, next);
    expect(JSON.stringify(merged).length).toBeLessThanOrEqual(AI_STUDIO_MAX_SESSION_SUMMARY_LENGTH);
    expect(validateSessionSummary(merged)).toEqual(merged);
  });

  it("rejects more than the bounded custom-variable contract", () => {
    const names = Array.from({ length: 41 }, (_, index) => `custom${index}`);
    const html = names.map((name) => `<span>{{${name}}}</span>`).join("");
    expect(validateCandidateContract({
      explanation: "Candidato.",
      html,
      suggestedName: "Template",
      customVariables: names.map((name) => ({ name, description: "Valor." })),
      sessionSummary: {
        focus: "Variáveis",
        decisions: [],
        pending: [],
        variables: names.slice(0, 40),
      },
    })).toBeNull();

    const bounded = mergeSessionSummaries(null, {
      focus: "Variáveis",
      decisions: [],
      pending: [],
      variables: names,
    });
    expect(bounded.variables).toHaveLength(40);
  });
});
