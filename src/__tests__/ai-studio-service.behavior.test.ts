import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AIProviderError } from "../lib/ai/provider-contract";

const mocks = vi.hoisted(() => ({
  connectionFindFirst: vi.fn(),
  consentFindFirst: vi.fn(),
  consentUpsert: vi.fn(),
  consentFindMany: vi.fn(),
  connectionFindMany: vi.fn(),
  usageDeleteMany: vi.fn(),
  usageCount: vi.fn(),
  usageCreate: vi.fn(),
  usageUpdateMany: vi.fn(),
  queryRaw: vi.fn(),
  transaction: vi.fn(),
  workspaceFindMany: vi.fn(),
  workspaceDirectiveFindUnique: vi.fn(),
  checkFeature: vi.fn(),
  getAIProvider: vi.fn(),
  encryptAiSecret: vi.fn((value: string) => `session.${Buffer.from(value, "utf8").toString("base64url")}`),
  decryptAiSecret: vi.fn((value: string) =>
    value.startsWith("session.")
      ? Buffer.from(value.slice("session.".length), "base64url").toString("utf8")
      : "sk-secret",
  ),
  withTenant: vi.fn((_tenantId: string, fn: () => unknown) => fn()),
  withTenantBypass: vi.fn((fn: () => unknown) => fn()),
  generateStructured: vi.fn(),
  generateStructuredStream: vi.fn(),
  proposalTemplateFindUnique: vi.fn(),
  proposalTemplateUpdate: vi.fn(),
  proposalCount: vi.fn(),
}));

vi.mock("../../prisma/client", () => ({
  prisma: {
    aiProviderConnection: {
      findFirst: mocks.connectionFindFirst,
      findMany: mocks.connectionFindMany,
    },
    aiStudioConsent: {
      findFirst: mocks.consentFindFirst,
      upsert: mocks.consentUpsert,
      findMany: mocks.consentFindMany,
    },
    aiStudioUsageEvent: {
      deleteMany: mocks.usageDeleteMany,
      count: mocks.usageCount,
      create: mocks.usageCreate,
      updateMany: mocks.usageUpdateMany,
    },
    workspace: {
      findMany: mocks.workspaceFindMany,
    },
    proposalTemplate: {
      findUnique: mocks.proposalTemplateFindUnique,
      update: mocks.proposalTemplateUpdate,
    },
    proposal: {
      count: mocks.proposalCount,
    },
    $transaction: mocks.transaction,
  },
  withTenant: mocks.withTenant,
  withTenantBypass: mocks.withTenantBypass,
}));

vi.mock("../lib/features", () => ({ checkFeature: mocks.checkFeature }));
vi.mock("../lib/ai/directives-service", () => ({
  getWorkspaceDirective: mocks.workspaceDirectiveFindUnique,
}));
vi.mock("../lib/ai/crypto", () => ({
  decryptAiSecret: mocks.decryptAiSecret,
  encryptAiSecret: mocks.encryptAiSecret,
}));
vi.mock("../lib/ai/providers", () => ({
  getAIProvider: mocks.getAIProvider,
  isAIProviderId: (value: unknown) => value === "openai" || value === "anthropic",
  listAIProviders: () => [],
}));

import {
  generateTemplateCandidate,
  getAIStudioUsageRetentionCutoff,
  getAIStudioRefinementBase,
  pruneAllAIStudioUsageEvents,
  pruneAIStudioUsageEvents,
  resetAIStudioRuntimeState,
  sanitizeAIStudioHtml,
  updateRefinedTemplate,
} from "../lib/ai/studio-service";
import {
  AI_STUDIO_CONSENT_VERSION,
  AI_STUDIO_GENERATION_TIMEOUT_MS,
  AI_STUDIO_MAX_HTML_LENGTH,
  AI_STUDIO_PROMPT_BASE_VERSION,
  AI_STUDIO_SESSION_TTL_MS,
} from "../lib/ai/studio-contract";
import { detectVariables } from "../lib/financial/proposal-variables";

const provider = {
  id: "openai" as const,
  name: "OpenAI",
  authMethods: ["api_key" as const],
  defaultModel: "gpt-4o",
  models: [{ id: "gpt-4o", vision: true, streaming: true, default: true }],
  validateApiKey: vi.fn(),
  generateStructured: mocks.generateStructured,
  generateStructuredStream: mocks.generateStructuredStream,
};

const connection = {
  id: "connection-1",
  provider: "openai",
  authMethod: "api_key",
  encryptedSecret: "encrypted-secret",
  defaultModel: "gpt-4o",
};

const validSessionSummary = {
  focus: "Briefing inicial convertido em um template.",
  decisions: ["Preservar placeholders existentes."],
  pending: [],
  variables: ["proposta.titulo", "cliente.nome"],
};

const validProviderText = JSON.stringify({
  explanation: "Candidato criado a partir do briefing.",
  html: "<section><h1>{{proposta.titulo}}</h1><p>{{cliente.nome}}</p></section>",
  suggestedName: "Proposta executiva",
  customVariables: [],
  sessionSummary: validSessionSummary,
});

describe("AI Studio service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resetAIStudioRuntimeState();
    delete process.env.AI_STUDIO_ENABLED;
    delete process.env.AI_STUDIO_KILL_SWITCH;
    mocks.checkFeature.mockResolvedValue(true);
    mocks.connectionFindFirst.mockResolvedValue(connection);
    mocks.consentFindFirst.mockResolvedValue({ id: "consent-1" });
    mocks.workspaceDirectiveFindUnique.mockResolvedValue({ content: "Tom executivo." });
    mocks.decryptAiSecret.mockImplementation((value: string) => value.startsWith("session.")
      ? Buffer.from(value.slice("session.".length), "base64url").toString("utf8")
      : "sk-secret");
    mocks.usageDeleteMany.mockResolvedValue({ count: 0 });
    mocks.usageCount.mockResolvedValue(0);
    mocks.usageCreate.mockResolvedValue({ id: "usage-1" });
    mocks.usageUpdateMany.mockResolvedValue({ count: 1 });
    mocks.queryRaw.mockResolvedValue([{ id: "tenant-1" }]);
    mocks.transaction.mockImplementation(async (callback: (transaction: unknown) => unknown) =>
      callback({
        $queryRaw: mocks.queryRaw,
        aiStudioUsageEvent: {
          deleteMany: mocks.usageDeleteMany,
          count: mocks.usageCount,
          create: mocks.usageCreate,
        },
      }),
    );
    mocks.getAIProvider.mockReturnValue(provider);
    mocks.generateStructured.mockResolvedValue({ text: validProviderText, inputTokens: 10, outputTokens: 20 });
  });

  afterEach(() => {
    resetAIStudioRuntimeState();
    vi.useRealTimers();
  });

  it("sends only the versioned prompt snapshot and returns sanitized candidate metadata", async () => {
    const result = await generateTemplateCandidate({
      tenantId: "tenant-1",
      actorId: "user-1",
      provider: "openai",
      model: "gpt-4o",
      message: "Crie uma proposta de consultoria.",
      locale: "pt-BR",
      consentVersion: AI_STUDIO_CONSENT_VERSION,
    });

    expect(result.candidate.html).toContain("{{proposta.titulo}}");
    expect(result.promptBaseVersion).toBe(AI_STUDIO_PROMPT_BASE_VERSION);
    expect(mocks.generateStructured).toHaveBeenCalledWith(
      "sk-secret",
      expect.objectContaining({
        model: "gpt-4o",
        systemPrompt: expect.stringContaining(AI_STUDIO_PROMPT_BASE_VERSION),
        userPrompt: expect.stringContaining("Crie uma proposta de consultoria."),
      }),
    );
    const reservation = mocks.usageCreate.mock.calls[0][0].data;
    expect(reservation).toMatchObject({ tenantId: "tenant-1", actorId: "user-1", status: "in_flight" });
    const usage = mocks.usageUpdateMany.mock.calls[0][0].data;
    expect(usage).toMatchObject({ status: "success" });
    expect(JSON.stringify(usage)).not.toContain("Crie uma proposta");
    expect(JSON.stringify(usage)).not.toContain("{{proposta.titulo}}");
  });

  it("strips unsafe resources before a candidate can reach preview", () => {
    const result = sanitizeAIStudioHtml('<section onclick="alert(1)"><script>alert(1)</script><img src="https://evil.test/x.png">OK</section>');
    expect(result.html).toContain("OK");
    expect(result.html).not.toContain("script");
    expect(result.html).not.toContain("onclick");
    expect(result.html).not.toContain("evil.test");
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("rejects HTML over the preview and persistence size limit", () => {
    expect(() => sanitizeAIStudioHtml(`<p>${"x".repeat(AI_STUDIO_MAX_HTML_LENGTH)}</p>`)).toThrow(
      expect.objectContaining({ code: "VALIDATION_ERROR" }),
    );
  });

  it("requires consent and respects the workspace rate limit", async () => {
    mocks.consentFindFirst.mockResolvedValue(null);
    await expect(generateTemplateCandidate({
      tenantId: "tenant-1", actorId: "user-1", provider: "openai", message: "Briefing", consentVersion: AI_STUDIO_CONSENT_VERSION,
    })).rejects.toMatchObject({ code: "CONSENT_REQUIRED" });

    mocks.consentFindFirst.mockResolvedValue({ id: "consent-1" });
    mocks.usageCount.mockResolvedValue(30);
    await expect(generateTemplateCandidate({
      tenantId: "tenant-1", actorId: "user-1", provider: "openai", message: "Briefing", consentVersion: AI_STUDIO_CONSENT_VERSION,
    })).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(mocks.generateStructured).not.toHaveBeenCalled();
    expect(mocks.transaction).toHaveBeenCalled();
  });

  it("preserves the last valid candidate when the provider returns an invalid contract", async () => {
    mocks.generateStructured.mockResolvedValue({ text: "{\"html\":\"<script>bad</script>\"}" });
    await expect(generateTemplateCandidate({
      tenantId: "tenant-1", actorId: "user-1", provider: "openai", message: "Briefing", consentVersion: AI_STUDIO_CONSENT_VERSION,
    })).rejects.toMatchObject({ code: "INVALID_STRUCTURED_OUTPUT" });
    expect(mocks.usageUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "error", errorCategory: "INVALID_STRUCTURED_OUTPUT" }) }));
  });

  it("uses provider streaming deltas without treating partial text as HTML", async () => {
    async function* chunks() {
      yield '{"explanation":"Candidato",';
      yield '"html":"<p>Seguro</p>","suggestedName":"Novo",';
      yield '"customVariables":[],"sessionSummary":{"focus":"Resumo","decisions":[],"pending":[],"variables":[]}}';
    }
    mocks.generateStructuredStream.mockReturnValue(chunks());
    const partial: string[] = [];
    const result = await generateTemplateCandidate(
      { tenantId: "tenant-1", actorId: "user-1", provider: "openai", message: "Briefing", consentVersion: AI_STUDIO_CONSENT_VERSION, stream: true },
      { onPartial: (text) => partial.push(text) },
    );
    expect(partial).toHaveLength(3);
    expect(result.streamed).toBe(true);
    expect(result.candidate.html).toBe("<p>Seguro</p>");
  });

  it("maps provider failures without retrying or falling back", async () => {
    mocks.generateStructured.mockRejectedValue(new AIProviderError("RATE_LIMITED", "provider limited"));
    await expect(generateTemplateCandidate({
      tenantId: "tenant-1", actorId: "user-1", provider: "openai", message: "Briefing", consentVersion: AI_STUDIO_CONSENT_VERSION,
    })).rejects.toMatchObject({ code: "PROVIDER_ERROR", providerErrorCode: "RATE_LIMITED" });
    expect(mocks.generateStructured).toHaveBeenCalledTimes(1);
  });

  it("surfaces a provider timeout as the session timeout state", async () => {
    mocks.generateStructured.mockRejectedValue(new AIProviderError("TIMEOUT", "provider timed out"));

    await expect(generateTemplateCandidate({
      tenantId: "tenant-1", actorId: "user-1", provider: "openai", message: "Briefing", consentVersion: AI_STUDIO_CONSENT_VERSION,
    })).rejects.toMatchObject({ code: "TIMEOUT", providerErrorCode: "TIMEOUT" });
    expect(mocks.generateStructured).toHaveBeenCalledTimes(1);
  });

  it("rejects a second generation for the same actor while the first is in flight", async () => {
    let release!: (result: { text: string }) => void;
    const pending = new Promise<{ text: string }>((resolve) => {
      release = resolve;
    });
    mocks.generateStructured.mockReturnValueOnce(pending);
    const input = {
      tenantId: "tenant-1",
      actorId: "user-1",
      provider: "openai" as const,
      message: "Briefing",
      consentVersion: AI_STUDIO_CONSENT_VERSION,
    };

    const first = generateTemplateCandidate(input);
    await vi.waitFor(() => expect(mocks.generateStructured).toHaveBeenCalledTimes(1));
    await expect(generateTemplateCandidate(input)).rejects.toMatchObject({ code: "GENERATION_IN_FLIGHT" });

    release({ text: validProviderText });
    await expect(first).resolves.toMatchObject({ candidate: { suggestedName: "Proposta executiva" } });
  });

  it("maps the generation abort to a timeout without retrying", async () => {
    vi.useFakeTimers();
    mocks.generateStructured.mockImplementation((_secret, request) => new Promise((_, reject) => {
      request.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    }));

    const generation = generateTemplateCandidate({
      tenantId: "tenant-1",
      actorId: "user-1",
      provider: "openai",
      message: "Briefing",
      consentVersion: AI_STUDIO_CONSENT_VERSION,
    });
    for (let attempt = 0; attempt < 20 && mocks.generateStructured.mock.calls.length === 0; attempt += 1) {
      await Promise.resolve();
    }
    expect(mocks.generateStructured).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(AI_STUDIO_GENERATION_TIMEOUT_MS);
    await Promise.resolve();

    await expect(generation).rejects.toMatchObject({ code: "TIMEOUT", providerErrorCode: "TIMEOUT" });
    expect(mocks.generateStructured).toHaveBeenCalledTimes(1);
  });

  it("honors the kill switch before touching the provider", async () => {
    process.env.AI_STUDIO_KILL_SWITCH = "true";
    await expect(generateTemplateCandidate({
      tenantId: "tenant-1", actorId: "user-1", provider: "openai", message: "Briefing", consentVersion: AI_STUDIO_CONSENT_VERSION,
    })).rejects.toMatchObject({ code: "KILL_SWITCHED" });
    expect(mocks.generateStructured).not.toHaveBeenCalled();
  });

  it("uses a fixed 90-day usage retention cutoff", () => {
    const now = new Date("2026-08-22T12:00:00.000Z");
    expect(getAIStudioUsageRetentionCutoff(now)).toEqual(new Date("2026-05-24T12:00:00.000Z"));
  });

  it("prunes only the current tenant's usage events before the retention cutoff", async () => {
    const now = new Date("2026-08-22T12:00:00.000Z");
    await pruneAIStudioUsageEvents("tenant-1", now);

    expect(mocks.usageDeleteMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: new Date("2026-05-24T12:00:00.000Z") } },
    });
  });

  it("prunes usage events for every workspace, including inactive workspaces", async () => {
    const now = new Date("2026-08-22T12:00:00.000Z");
    mocks.workspaceFindMany.mockResolvedValue([
      { id: "tenant-1", status: "active", deletedAt: null },
      { id: "tenant-2", status: "cancelled", deletedAt: new Date("2026-08-01T00:00:00.000Z") },
    ]);
    mocks.withTenantBypass.mockImplementation((fn: () => unknown) => fn());

    await expect(pruneAllAIStudioUsageEvents(now)).resolves.toBe(2);

    expect(mocks.workspaceFindMany).toHaveBeenCalledWith({
      select: { id: true, status: true, deletedAt: true },
    });
    expect(mocks.withTenant).toHaveBeenCalledWith("tenant-1", expect.any(Function));
    expect(mocks.withTenant).toHaveBeenCalledWith("tenant-2", expect.any(Function));
    expect(mocks.usageDeleteMany).toHaveBeenCalledTimes(2);
  });
});

describe("AI Studio continuous session service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resetAIStudioRuntimeState();
    delete process.env.AI_STUDIO_ENABLED;
    delete process.env.AI_STUDIO_KILL_SWITCH;
    delete process.env.AI_STUDIO_MAX_REQUEST_BYTES;
    mocks.checkFeature.mockResolvedValue(true);
    mocks.connectionFindFirst.mockResolvedValue(connection);
    mocks.consentFindFirst.mockResolvedValue({ id: "consent-1" });
    mocks.workspaceDirectiveFindUnique.mockResolvedValue({ content: "Tom executivo." });
    mocks.decryptAiSecret.mockImplementation((value: string) => value.startsWith("session.")
      ? Buffer.from(value.slice("session.".length), "base64url").toString("utf8")
      : "sk-secret");
    mocks.usageDeleteMany.mockResolvedValue({ count: 0 });
    mocks.usageCount.mockResolvedValue(0);
    mocks.usageCreate.mockResolvedValue({ id: "usage-1" });
    mocks.usageUpdateMany.mockResolvedValue({ count: 1 });
    mocks.queryRaw.mockResolvedValue([{ id: "tenant-1" }]);
    mocks.transaction.mockImplementation(async (callback: (transaction: unknown) => unknown) =>
      callback({
        $queryRaw: mocks.queryRaw,
        aiStudioUsageEvent: {
          deleteMany: mocks.usageDeleteMany,
          count: mocks.usageCount,
          create: mocks.usageCreate,
        },
      }),
    );
    mocks.getAIProvider.mockReturnValue(provider);
    mocks.generateStructured.mockResolvedValue({ text: validProviderText, inputTokens: 10, outputTokens: 20 });
  });

  afterEach(() => {
    resetAIStudioRuntimeState();
    delete process.env.AI_STUDIO_MAX_REQUEST_BYTES;
  });

  it("forwards only the recent-message window and the session summary to the provider", async () => {
    const history = Array.from({ length: 20 }, (_, index) => ({
      role: (index % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `mensagem-antiga-${index}`,
    }));
    await generateTemplateCandidate({
      tenantId: "tenant-1",
      actorId: "user-1",
      provider: "openai",
      message: "Ajuste o rodapé.",
      consentVersion: AI_STUDIO_CONSENT_VERSION,
      recentMessages: history,
      sessionSummary: { ...validSessionSummary, focus: "Sessão com decisões sobre cores e seções." },
    });

    const userPrompt = mocks.generateStructured.mock.calls[0][1].userPrompt as string;
    expect(userPrompt).toContain("Sessão com decisões sobre cores e seções.");
    expect(userPrompt).toContain("mensagem-antiga-19");
    expect(userPrompt).not.toContain("mensagem-antiga-0");
    expect(userPrompt).not.toContain("mensagem-antiga-11");
  });

  it("compacts an accepted long briefing before it can poison the next transcript turn", async () => {
    const longMessage = "x".repeat(8_000);
    await generateTemplateCandidate({
      tenantId: "tenant-1",
      actorId: "user-1",
      provider: "openai",
      message: "Continue.",
      consentVersion: AI_STUDIO_CONSENT_VERSION,
      recentMessages: [{ role: "user", content: longMessage }],
    });

    const userPrompt = mocks.generateStructured.mock.calls[0][1].userPrompt as string;
    expect(userPrompt).not.toContain(longMessage);
    expect(userPrompt).toContain("[earlier content omitted]");
  });

  it("keeps the workspace directive snapshot stable for the same ephemeral session", async () => {
    const session = {
      tenantId: "tenant-1",
      actorId: "user-1",
      provider: "openai" as const,
      message: "Defina o rodapé.",
      consentVersion: AI_STUDIO_CONSENT_VERSION,
      sessionId: "session-1",
    };

    const first = await generateTemplateCandidate(session);
    mocks.workspaceDirectiveFindUnique.mockResolvedValue({ content: "Diretriz alterada." });
    await generateTemplateCandidate({
      ...session,
      message: "Continue o rodapé.",
      locale: "en",
      sessionSnapshot: first.sessionSnapshot,
    });

    const secondPrompt = mocks.generateStructured.mock.calls[1][1].systemPrompt as string;
    expect(secondPrompt).toContain('"locale": "pt-BR"');
    expect(secondPrompt).toContain("Tom executivo.");
    expect(secondPrompt).not.toContain("Diretriz alterada.");
    expect(mocks.workspaceDirectiveFindUnique).toHaveBeenCalledTimes(1);
  });

  it("expires directive snapshots instead of retaining session history", async () => {
    vi.useFakeTimers();
    const first = await generateTemplateCandidate({
      tenantId: "tenant-1",
      actorId: "user-1",
      provider: "openai",
      message: "Primeiro turno.",
      consentVersion: AI_STUDIO_CONSENT_VERSION,
      sessionId: "session-expiring",
    });

    vi.advanceTimersByTime(AI_STUDIO_SESSION_TTL_MS + 1);
    await expect(generateTemplateCandidate({
      tenantId: "tenant-1",
      actorId: "user-1",
      provider: "openai",
      message: "Novo contexto.",
      consentVersion: AI_STUDIO_CONSENT_VERSION,
      sessionId: "session-expiring",
      sessionSnapshot: first.sessionSnapshot,
    })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    expect(mocks.workspaceDirectiveFindUnique).toHaveBeenCalledTimes(1);
  });

  it("rejects a session snapshot reused by another tenant, actor or session", async () => {
    const first = await generateTemplateCandidate({
      tenantId: "tenant-1",
      actorId: "user-1",
      provider: "openai",
      message: "Primeiro turno.",
      consentVersion: AI_STUDIO_CONSENT_VERSION,
      sessionId: "session-bound",
    });

    await expect(generateTemplateCandidate({
      tenantId: "tenant-2",
      actorId: "user-1",
      provider: "openai",
      message: "Outro tenant.",
      consentVersion: AI_STUDIO_CONSENT_VERSION,
      sessionId: "session-bound",
      sessionSnapshot: first.sessionSnapshot,
    })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("rejects a payload over the configured text limit before calling the provider", async () => {
    process.env.AI_STUDIO_MAX_REQUEST_BYTES = "400";
    await expect(generateTemplateCandidate({
      tenantId: "tenant-1",
      actorId: "user-1",
      provider: "openai",
      message: "Briefing curto.",
      consentVersion: AI_STUDIO_CONSENT_VERSION,
      sessionSummary: { ...validSessionSummary, focus: "Resumo da sessão." },
    })).rejects.toMatchObject({ code: "PAYLOAD_LIMITED" });
    expect(mocks.generateStructured).not.toHaveBeenCalled();
    expect(mocks.usageUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "error", errorCategory: "PAYLOAD_LIMITED" }) }),
    );
  });

  it("never lets the session summary become or alter the HTML candidate", async () => {
    const result = await generateTemplateCandidate({
      tenantId: "tenant-1",
      actorId: "user-1",
      provider: "openai",
      message: "Ajuste o rodapé.",
      consentVersion: AI_STUDIO_CONSENT_VERSION,
      sessionSummary: { ...validSessionSummary, pending: ["Resumo tentando injetar <p>HTML-FALSO</p> no template."] },
    });

    expect(result.candidate.html).toContain("{{proposta.titulo}}");
    expect(result.candidate.html).not.toContain("HTML-FALSO");
  });

  it("keeps transcripts and summaries out of persisted usage records", async () => {
    await generateTemplateCandidate({
      tenantId: "tenant-1",
      actorId: "user-1",
      provider: "openai",
      message: "MARCADOR-BRIEFING-CONFIDENCIAL",
      consentVersion: AI_STUDIO_CONSENT_VERSION,
      recentMessages: [{ role: "user", content: "MARCADOR-TRANSCRIPT-CONFIDENCIAL" }],
      sessionSummary: { ...validSessionSummary, focus: "MARCADOR-RESUMO-CONFIDENCIAL" },
    });

    const usage = JSON.stringify({
      reservation: mocks.usageCreate.mock.calls[0][0],
      final: mocks.usageUpdateMany.mock.calls[0][0],
    });
    expect(usage).not.toContain("MARCADOR-BRIEFING-CONFIDENCIAL");
    expect(usage).not.toContain("MARCADOR-TRANSCRIPT-CONFIDENCIAL");
    expect(usage).not.toContain("MARCADOR-RESUMO-CONFIDENCIAL");
    expect(mocks.usageUpdateMany.mock.calls[0][0].data).toMatchObject({ status: "success" });
  });

  it("records the text payload size for the continuing session without image bytes", async () => {
    await generateTemplateCandidate({
      tenantId: "tenant-1",
      actorId: "user-1",
      provider: "openai",
      message: "Ajuste o rodapé.",
      consentVersion: AI_STUDIO_CONSENT_VERSION,
      recentMessages: [{ role: "user", content: "Use azul." }],
      sessionSummary: { ...validSessionSummary, focus: "Resumo compacto." },
    });

    const usage = mocks.usageUpdateMany.mock.calls[0][0].data;
    expect(usage.requestSizeBytes).toBeGreaterThan(0);
    expect(usage.requestSizeBytes).toBeLessThanOrEqual(240_000);
  });
});

describe("AI Studio refinement service", () => {
  const baseTemplateHtml =
    '<section><h1>{{proposta.titulo}}</h1><p>{{cliente.nome}}</p>{{itens}}<img src="https://evil.test/x.png"></section>';

  beforeEach(() => {
    vi.resetAllMocks();
    resetAIStudioRuntimeState();
    delete process.env.AI_STUDIO_ENABLED;
    delete process.env.AI_STUDIO_KILL_SWITCH;
    mocks.checkFeature.mockResolvedValue(true);
    mocks.connectionFindFirst.mockResolvedValue(connection);
    mocks.consentFindFirst.mockResolvedValue({ id: "consent-1" });
    mocks.workspaceDirectiveFindUnique.mockResolvedValue({ content: null });
    mocks.decryptAiSecret.mockImplementation((value: string) => value.startsWith("session.")
      ? Buffer.from(value.slice("session.".length), "base64url").toString("utf8")
      : "sk-secret");
    mocks.usageDeleteMany.mockResolvedValue({ count: 0 });
    mocks.usageCount.mockResolvedValue(0);
    mocks.usageCreate.mockResolvedValue({ id: "usage-1" });
    mocks.usageUpdateMany.mockResolvedValue({ count: 1 });
    mocks.queryRaw.mockResolvedValue([{ id: "tenant-1" }]);
    mocks.transaction.mockImplementation(async (callback: (transaction: unknown) => unknown) =>
      callback({
        $queryRaw: mocks.queryRaw,
        aiStudioUsageEvent: {
          deleteMany: mocks.usageDeleteMany,
          count: mocks.usageCount,
          create: mocks.usageCreate,
        },
      }),
    );
    mocks.getAIProvider.mockReturnValue(provider);
    mocks.generateStructured.mockResolvedValue({ text: validProviderText, inputTokens: 10, outputTokens: 20 });
    mocks.proposalTemplateFindUnique.mockResolvedValue({ id: "template-1", name: "Base executiva", html: baseTemplateHtml });
    mocks.proposalTemplateUpdate.mockResolvedValue({ id: "template-1", name: "Base executiva", html: "<p>Atualizado</p>" });
    mocks.proposalCount.mockResolvedValue(0);
  });

  afterEach(() => {
    resetAIStudioRuntimeState();
  });

  it("sanitizes the base before generation and diffs variables against it", async () => {
    const result = await generateTemplateCandidate({
      tenantId: "tenant-1",
      actorId: "user-1",
      provider: "openai",
      message: "Ajuste as cores.",
      consentVersion: AI_STUDIO_CONSENT_VERSION,
      baseHtml: baseTemplateHtml,
    });

    const userPrompt = mocks.generateStructured.mock.calls[0][1].userPrompt as string;
    expect(userPrompt).toContain("{{proposta.titulo}}");
    expect(userPrompt).not.toContain("evil.test");
    expect(result.candidate.variableDiff).toEqual({
      added: [],
      removed: ["itens"],
      preserved: ["cliente.nome", "proposta.titulo"],
    });
    expect(result.candidate.warnings.some((warning) => warning.includes("recursos externos"))).toBe(true);
  });

  it("starts a refinement generation with no prior transcript or summary", async () => {
    await generateTemplateCandidate({
      tenantId: "tenant-1",
      actorId: "user-1",
      provider: "openai",
      message: "Ajuste as cores.",
      consentVersion: AI_STUDIO_CONSENT_VERSION,
      baseHtml: baseTemplateHtml,
    });

    const userPrompt = mocks.generateStructured.mock.calls[0][1].userPrompt as string;
    expect(userPrompt).toContain("session_summary: (new session)");
    expect(userPrompt).toContain("recent_messages: (none)");
  });

  it("rejects an oversized refinement base before calling the provider", async () => {
    await expect(generateTemplateCandidate({
      tenantId: "tenant-1",
      actorId: "user-1",
      provider: "openai",
      message: "Ajuste.",
      consentVersion: AI_STUDIO_CONSENT_VERSION,
      baseHtml: `<p>${"x".repeat(AI_STUDIO_MAX_HTML_LENGTH)}</p>`,
    })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(mocks.generateStructured).not.toHaveBeenCalled();
  });

  it("loads a tenant-scoped refinement base with sanitization warnings and draft impact", async () => {
    mocks.proposalCount.mockResolvedValue(2);
    const base = await getAIStudioRefinementBase("tenant-1", "template-1");

    expect(mocks.proposalTemplateFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "template-1" } }),
    );
    expect(base.name).toBe("Base executiva");
    expect(base.html).toContain("{{itens}}");
    expect(base.html).not.toContain("evil.test");
    expect(base.warnings.length).toBeGreaterThan(0);
    expect(base.draftCount).toBe(2);
  });

  it("treats a missing or cross-tenant template as not found", async () => {
    mocks.proposalTemplateFindUnique.mockResolvedValue(null);
    await expect(getAIStudioRefinementBase("tenant-1", "template-2")).rejects.toMatchObject({
      code: "TEMPLATE_NOT_FOUND",
    });
    await expect(getAIStudioRefinementBase("tenant-1", "")).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("reports a distinct error when a hand-authored base cannot be sanitized", async () => {
    mocks.proposalTemplateFindUnique.mockResolvedValue({
      id: "template-legacy",
      name: "Template legado",
      html: "<script>alert(1)</script>",
    });
    await expect(getAIStudioRefinementBase("tenant-1", "template-legacy")).rejects.toMatchObject({
      code: "INVALID_BASE_HTML",
    });
    await expect(getAIStudioRefinementBase("tenant-1", "template-legacy")).rejects.toMatchObject({
      message: expect.stringContaining("base"),
    });
  });

  it("requires explicit confirmation before updating the original template", async () => {
    await expect(updateRefinedTemplate({
      tenantId: "tenant-1",
      actorId: "user-1",
      templateId: "template-1",
      html: "<p>Novo</p>",
      confirmed: false,
    })).rejects.toMatchObject({ code: "UPDATE_CONFIRMATION_REQUIRED" });
    expect(mocks.proposalTemplateUpdate).not.toHaveBeenCalled();
  });

  it("sanitizes and applies the confirmed update, reporting draft impact without touching proposals", async () => {
    mocks.proposalCount.mockResolvedValue(4);
    const result = await updateRefinedTemplate({
      tenantId: "tenant-1",
      actorId: "user-1",
      templateId: "template-1",
      html: "<p>Novo</p><script>alert(1)</script>",
      confirmed: true,
    });

    expect(mocks.proposalTemplateUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "template-1" },
        data: { html: "<p>Novo</p>" },
      }),
    );
    expect(mocks.proposalTemplateUpdate).toHaveBeenCalledTimes(1);
    expect(result.draftCount).toBe(4);
    expect(JSON.stringify(mocks.proposalTemplateUpdate.mock.calls[0][0])).not.toContain("htmlSnapshot");
  });

  it("refuses to update a template that no longer exists", async () => {
    mocks.proposalTemplateFindUnique.mockResolvedValue(null);
    await expect(updateRefinedTemplate({
      tenantId: "tenant-1",
      actorId: "user-1",
      templateId: "template-missing",
      html: "<p>Novo</p>",
      confirmed: true,
    })).rejects.toMatchObject({ code: "TEMPLATE_NOT_FOUND" });
  });

  it("keeps unresolved custom variables savable and detectable by the proposal flow", async () => {
    const htmlWithCustom = "<section><p>{{cliente.nome}}</p><p>{{prazo.entrega}}</p></section>";
    await updateRefinedTemplate({
      tenantId: "tenant-1",
      actorId: "user-1",
      templateId: "template-1",
      html: htmlWithCustom,
      confirmed: true,
    });

    const savedHtml = mocks.proposalTemplateUpdate.mock.calls[0][0].data.html as string;
    expect(savedHtml).toContain("{{prazo.entrega}}");
    expect(detectVariables(savedHtml).map((variable) => variable.name)).toContain("prazo.entrega");
  });
});
